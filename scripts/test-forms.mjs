// Синтетические данные и транспорт без внешних запросов, диска и журналирования обращений.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { create_lead_handler, read_lead_config } from '../server/leads.mjs';
import { validate_lead, lead_contexts } from '../server/lead-contract.mjs';

const sample = () => ({ name: 'Тест', contact: 'synthetic@example.invalid', message: 'Автоматическая проверка', context: 'general', consent: true, consent_version: 'test-v1', website: '' });
const config = { enabled: true, origin: 'https://example.invalid', consent_version: 'test-v1', trusted_proxy_ips: [] };
const transport = { kind: 'test', async send() { return { acknowledged: true, reference: 'synthetic-receipt' }; } };

async function fixture(options, run) {
  const handler = create_lead_handler({ config, transport, test_mode: true, rate_max: 100, ...options });
  const server = createServer((req, res) => { void handler(req, res).catch(() => { res.writeHead(500); res.end(); }); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/leads`;
  const send = async (body = sample(), overrides = {}) => {
    const headers = { Origin: config.origin, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), ...overrides.headers };
    const response = await fetch(url, { method: 'POST', ...overrides, headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  try { await run(send, url); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

test('выключенный endpoint не читает тело и не вызывает транспорт', async () => {
  let read = false;
  let sent = false;
  let status;
  let result;
  const handler = create_lead_handler({ config: { ...config, enabled: false }, transport: { kind: 'delivery', send() { sent = true; } } });
  await handler({ url: '/api/leads', method: 'POST', on() { read = true; throw new Error('body must remain unread'); } }, {
    writeHead(code) { status = code; }, end(body) { result = JSON.parse(body); },
  });
  assert.equal(status, 503);
  assert.equal(result.ok, false);
  assert.equal(read, false);
  assert.equal(sent, false);
});

test('тестовый транспорт без test_mode никогда не принимает заявки', async () => {
  await fixture({ test_mode: false }, async (send) => assert.equal((await send()).status, 503));
});

test('успех только после подтверждения транспорта; ответ не раскрывает данные', async () => {
  await fixture({}, async (send) => {
    const result = await send();
    assert.equal(result.status, 200);
    assert.equal(result.body.code, 'delivered');
    assert.match(result.body.receipt, /^[a-f\d-]{36}$/u);
    assert.equal(JSON.stringify(result.body).includes('synthetic'), false);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.has('access-control-allow-origin'), false);
  });
});

test('обязательны Origin и same-origin запрос', async () => {
  await fixture({}, async (send) => {
    assert.equal((await send(sample(), { headers: { Origin: 'https://other.invalid' } })).status, 403);
    assert.equal((await send(sample(), { headers: { Origin: '' } })).status, 403);
    assert.equal((await send(sample(), { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  });
});

test('только POST /api/leads; preflight не открывает CORS', async () => {
  await fixture({}, async (_, url) => {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, { method: 'OPTIONS' })).status, 405);
    assert.equal((await fetch(url.replace('/api/leads', '/.env'))).status, 404);
    assert.equal((await fetch(`${url}?recipient=evil`, { method: 'POST' })).status, 404);
  });
});

test('JSON content-type, сжатие и ключ запроса проверяются', async () => {
  await fixture({}, async (send) => {
    assert.equal((await send(sample(), { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await send(sample(), { headers: { 'Content-Encoding': 'gzip' } })).status, 415);
    assert.equal((await send(sample(), { headers: { 'Idempotency-Key': 'arbitrary' } })).status, 400);
    assert.equal((await send('{')).status, 400);
  });
});

test('поля, типы и согласие валидируются сервером', async () => {
  const invalid = [null, [], {}, { ...sample(), name: '' }, { ...sample(), name: '\r\nHeader: value' },
    { ...sample(), name: 'x'.repeat(81) }, { ...sample(), contact: 'bad' }, { ...sample(), contact: 'a'.repeat(255) },
    { ...sample(), message: 'x'.repeat(2001) }, { ...sample(), message: '\u0000' }, { ...sample(), consent: false },
    { ...sample(), consent: 'true' }, { ...sample(), consent_version: 'old' }, { ...sample(), website: 'spam' },
    { ...sample(), context: 'recipient:evil' }, { ...sample(), to: 'evil@example.invalid' }, { ...sample(), name: { nested: true } }];
  await fixture({}, async (send) => {
    for (const body of invalid) assert.equal((await send(body)).status, 422, JSON.stringify(body));
  });
});

test('реестр контекстов охватывает услуги, проекты и работы', () => {
  for (const context of lead_contexts) assert.ok(validate_lead({ ...sample(), context }, 'test-v1').lead, context);
  assert.equal(lead_contexts.size, 41);
});

test('корректные телефон и email; текст не интерпретируется как HTML', async () => {
  let received;
  await fixture({ transport: { kind: 'test', async send(lead) { received = lead; return { acknowledged: true, reference: 'test' }; } } }, async (send) => {
    const result = await send({ ...sample(), contact: '+7 (000) 000-00-00', message: '<img src=x onerror=alert(1)>' });
    assert.equal(result.status, 200);
    assert.equal(received.message, '<img src=x onerror=alert(1)>');
    assert.equal(JSON.stringify(result.body).includes('<img'), false);
  });
});

test('лимит размера с Content-Length', async () => {
  await fixture({}, async (send) => assert.equal((await send('x'.repeat(9000))).status, 413));
});

test('лимит фактически прочитанного chunked тела', async () => {
  await fixture({}, async (_, url) => {
    const status = await new Promise((resolve, reject) => {
      const req = request(url, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'Transfer-Encoding': 'chunked' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject);
      req.write('x'.repeat(5000));
      req.end('x'.repeat(5000));
    });
    assert.equal(status, 413);
  });
});

test('rate limit нельзя обойти подменой X-Real-IP', async () => {
  await fixture({ rate_max: 1 }, async (send) => {
    assert.equal((await send(sample(), { headers: { 'X-Real-IP': '192.0.2.1' } })).status, 200);
    const second = await send({ ...sample(), message: 'another' }, { headers: { 'X-Real-IP': '192.0.2.2' } });
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers.get('retry-after')) > 0);
  });
});

test('доверенный proxy требует валидный X-Real-IP', async () => {
  await fixture({ config: { ...config, trusted_proxy_ips: ['127.0.0.1'] }, rate_max: 1 }, async (send) => {
    assert.equal((await send()).status, 400);
    assert.equal((await send(sample(), { headers: { 'X-Real-IP': '192.0.2.1, 192.0.2.2' } })).status, 400);
    assert.equal((await send(sample(), { headers: { 'X-Real-IP': '192.0.2.1' } })).status, 200);
    assert.equal((await send({ ...sample(), message: 'second' }, { headers: { 'X-Real-IP': '192.0.2.2' } })).status, 200);
  });
});

test('повтор с тем же ключом возвращает прежнее подтверждение без новой доставки', async () => {
  let calls = 0;
  await fixture({ transport: { kind: 'test', async send() { calls++; return { acknowledged: true, reference: 'test' }; } } }, async (send) => {
    const options = { headers: { 'Idempotency-Key': randomUUID() } };
    const first = await send(sample(), options);
    const second = await send(sample(), options);
    assert.deepEqual(first.body, second.body);
    assert.equal(calls, 1);
    assert.equal((await send({ ...sample(), message: 'changed' }, options)).status, 409);
    assert.equal((await send()).body.code, 'duplicate_request');
  });
});

test('параллельный дубль не вызывает второй transport.send', async () => {
  let release;
  let started;
  const entered = new Promise((resolve) => { started = resolve; });
  await fixture({ transport: { kind: 'test', async send() { started(); await new Promise((resolve) => { release = resolve; }); return { acknowledged: true, reference: 'test' }; } } }, async (send) => {
    const options = { headers: { 'Idempotency-Key': randomUUID() } };
    const first = send(sample(), options);
    await entered;
    assert.equal((await send(sample(), options)).body.code, 'request_in_progress');
    release();
    assert.equal((await first).status, 200);
  });
});

test('ошибка и отсутствие ack не превращаются в успех; автоматического повтора нет', async () => {
  for (const send_result of [async () => { throw new Error('secret payload must not leak'); }, async () => ({ acknowledged: false })]) {
    let calls = 0;
    await fixture({ transport: { kind: 'test', async send() { calls++; return send_result(); } } }, async (send) => {
      const options = { headers: { 'Idempotency-Key': randomUUID() } };
      const first = await send(sample(), options);
      assert.equal(first.status, 502);
      assert.equal(first.body.ok, false);
      assert.equal(JSON.stringify(first.body).includes('secret'), false);
      assert.equal((await send(sample(), options)).body.code, 'delivery_uncertain');
      assert.equal(calls, 1);
    });
  }
});

test('provider idempotency key одинаков после перезапуска handler', async () => {
  const keys = [];
  const id = randomUUID();
  const adapter = { kind: 'test', async send(_, options) { keys.push(options.idempotency_key); return { acknowledged: true, reference: 'test' }; } };
  for (let attempt = 0; attempt < 2; attempt++) {
    await fixture({ transport: adapter }, async (send) => assert.equal((await send(sample(), { headers: { 'Idempotency-Key': id } })).status, 200));
  }
  assert.deepEqual(keys, [`ses-lead-${id}`, `ses-lead-${id}`]);
});

test('таймаут abort и неопределённая доставка', async () => {
  let aborted = false;
  await fixture({ transport_timeout: 10, transport: { kind: 'test', async send(_, { signal }) { signal.addEventListener('abort', () => { aborted = true; }); await new Promise(() => {}); } } }, async (send) => {
    assert.equal((await send()).body.code, 'delivery_uncertain');
    assert.equal(aborted, true);
  });
});

test('TTL освобождает лимит и bounded cache защищает память', async () => {
  let now = 1000;
  await fixture({ rate_max: 1, rate_window: 10, dedupe_window: 20, clock: () => now }, async (send) => {
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 429);
    now += 21;
    assert.equal((await send()).status, 200);
  });
  await fixture({ capacity: 1 }, async (send) => {
    assert.equal((await send()).status, 200);
    assert.equal((await send({ ...sample(), message: 'other' })).status, 503);
  });
});

test('конфигурация выключена по умолчанию и не принимает небезопасный origin', () => {
  assert.equal(read_lead_config({}).enabled, false);
  assert.equal(read_lead_config({ LEADS_ENABLED: 'true' }).enabled, false);
  for (const origin of ['http://example.invalid', 'https://example.invalid/path', 'bad']) {
    assert.throws(() => read_lead_config({ LEADS_ENABLED: 'true', LEADS_LEGAL_APPROVED: 'true', LEADS_ORIGIN: origin, LEADS_CONSENT_VERSION: 'v1' }));
  }
  assert.throws(() => read_lead_config({ LEADS_TRUSTED_PROXY_IPS: '*' }));
  assert.equal(read_lead_config({ LEADS_ENABLED: 'true', LEADS_LEGAL_APPROVED: 'true', LEADS_ORIGIN: 'https://example.invalid', LEADS_CONSENT_VERSION: 'v1' }).enabled, true);
});

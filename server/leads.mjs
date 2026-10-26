import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { lead_limits, validate_lead } from './lead-contract.mjs';
import { disabled_transport } from './transports.mjs';
import { legal_content_approved } from './release-config.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function read_lead_config(env = process.env) {
  const enabled = env.LEADS_ENABLED === 'true' && env.LEADS_LEGAL_APPROVED === 'true';
  const origin = env.LEADS_ORIGIN || '';
  const consent_version = env.LEADS_CONSENT_VERSION || '';
  const trusted_proxy_ips = (env.LEADS_TRUSTED_PROXY_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);
  if (trusted_proxy_ips.some((ip) => !isIP(ip))) throw new Error('invalid_trusted_proxy_configuration');
  if (enabled) {
    const url = new URL(origin);
    const local = env.LEADS_ENV === 'development' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.origin !== origin || (!local && url.protocol !== 'https:') || !/^[-\w.]{1,64}$/u.test(consent_version)) {
      throw new Error('invalid_leads_configuration');
    }
  }
  return { enabled, origin, consent_version, trusted_proxy_ips };
}

function respond(res, status, code, extra = {}, headers = {}) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(JSON.stringify({ ok: status === 200, code, ...extra }));
}

async function read_json(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let finished = false;
    const fail = (code, status) => {
      if (finished) return;
      finished = true;
      chunks.length = 0;
      req.pause();
      reject(Object.assign(new Error(code), { status }));
    };
    req.on('data', (chunk) => {
      if (finished) return;
      length += chunk.length;
      if (length > lead_limits.body) return fail('request_too_large', 413);
      chunks.push(chunk);
    });
    req.once('aborted', () => fail('request_aborted', 400));
    req.once('error', () => fail('request_error', 400));
    req.once('end', () => {
      if (finished) return;
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        finished = true;
        chunks.length = 0;
        resolve(input);
      } catch { fail('invalid_json', 400); }
    });
  });
}

/**
 * Один экземпляр Node: TTL-кэши ограничены по объёму, не содержат текст заявок или адреса IP.
 * Для нескольких инстансов нужны общий limiter/idempotency store и гарантия провайдера.
 */
export function create_lead_handler({ config = read_lead_config(), transport = disabled_transport,
  test_mode = false, rate_max = 5, rate_window = 60_000, dedupe_window = 600_000,
  capacity = 10_000, transport_timeout = 10_000, clock = Date.now } = {}) {
  const active = legal_content_approved && config.enabled && transport.kind === 'delivery';
  const test_active = test_mode && config.enabled && transport.kind === 'test';
  const secret = randomBytes(32);
  const rates = new Map();
  const deliveries = new Map();
  const signatures = new Map();
  const digest = (value) => createHmac('sha256', secret).update(value).digest('hex');
  const prune = (map, now) => {
    for (const [key, entry] of map) if (entry.expires <= now) map.delete(key);
  };

  return async function handle(req, res) {
    // Не обслуживаем статику, служебные файлы или другие публичные endpoints.
    if (req.url !== '/api/leads') return respond(res, 404, 'not_found');
    if (req.method !== 'POST') return respond(res, 405, 'method_not_allowed', {}, { Allow: 'POST' });
    if (!active && !test_active) {
      return respond(res, 503, 'unavailable', {}, { 'Retry-After': '3600', Connection: 'close' });
    }
    if (req.headers.origin !== config.origin || req.headers['sec-fetch-site'] === 'cross-site') {
      return respond(res, 403, 'origin_rejected');
    }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(req.headers['content-type'] || '')) {
      return respond(res, 415, 'json_required');
    }
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
      return respond(res, 415, 'encoding_rejected');
    }
    const declared = req.headers['content-length'];
    if (declared && (!/^\d+$/u.test(declared) || Number(declared) > lead_limits.body)) {
      return respond(res, 413, 'request_too_large', {}, { Connection: 'close' });
    }
    const idempotency_key = req.headers['idempotency-key'];
    if (typeof idempotency_key !== 'string' || !uuid.test(idempotency_key)) return respond(res, 400, 'invalid_request_key');
    let ip = req.socket.remoteAddress || '';
    if (config.trusted_proxy_ips.includes(ip)) {
      const forwarded = req.headers['x-real-ip'];
      if (typeof forwarded !== 'string' || !isIP(forwarded)) return respond(res, 400, 'invalid_proxy_address');
      ip = forwarded;
    }
    const now = clock();
    prune(rates, now);
    prune(deliveries, now);
    prune(signatures, now);
    const client = digest(ip);
    const rate = rates.get(client);
    if (rate && rate.count >= rate_max) return respond(res, 429, 'rate_limited', {}, { 'Retry-After': String(Math.max(1, Math.ceil((rate.expires - now) / 1000))) });
    if (!rate && rates.size >= capacity) return respond(res, 503, 'busy');
    rates.set(client, { count: (rate?.count || 0) + 1, expires: rate?.expires || now + rate_window });
    let input;
    try {
      input = await read_json(req);
    } catch (error) {
      return respond(res, error.status || 400, error.status === 413 ? 'request_too_large' : 'invalid_json', {}, { Connection: 'close' });
    }
    const validation = validate_lead(input, config.consent_version);
    if (validation.errors) return respond(res, 422, 'validation_error', { fields: Object.keys(validation.errors) });
    const lead = validation.lead;
    const signature = digest(JSON.stringify(lead));
    const key = digest(`${client}:${idempotency_key}`);
    const previous = deliveries.get(key);
    if (previous) {
      if (previous.signature !== signature) return respond(res, 409, 'request_key_reused');
      if (previous.state === 'delivered') return respond(res, 200, 'delivered', { receipt: previous.receipt });
      return respond(res, 409, previous.state === 'pending' ? 'request_in_progress' : 'delivery_uncertain');
    }
    if (signatures.has(signature)) return respond(res, 409, 'duplicate_request');
    if (deliveries.size >= capacity || signatures.size >= capacity) return respond(res, 503, 'busy');
    const entry = { state: 'pending', signature, expires: now + dedupe_window };
    deliveries.set(key, entry);
    signatures.set(signature, { expires: now + dedupe_window });
    const controller = new AbortController();
    let timeout;
    try {
      const deadline = new Promise((_, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('transport_timeout')); }, transport_timeout);
      });
      // UUID стабилен между перезапусками и инстансами; локальный HMAC для cache туда не передаётся.
      const result = await Promise.race([transport.send(lead, { signal: controller.signal, idempotency_key: `ses-lead-${idempotency_key}` }), deadline]);
      if (result?.acknowledged !== true || typeof result.reference !== 'string' || !result.reference) {
        throw new Error('delivery_not_acknowledged');
      }
      entry.state = 'delivered';
      entry.receipt = randomUUID();
      return respond(res, 200, 'delivered', { receipt: entry.receipt });
    } catch {
      // После неизвестного исхода повторная доставка запрещена до истечения окна.
      // Никакие exception.message / payload / IP / контакты не пишутся в журналы.
      entry.state = 'uncertain';
      return respond(res, 502, 'delivery_uncertain');
    } finally {
      clearTimeout(timeout);
    }
  };
}

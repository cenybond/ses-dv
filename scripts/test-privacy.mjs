// Изолированные тесты: никаких запросов к реальной Метрике.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { make_site_config } from '../src/data/site-config.ts';
import { parse_consent, consent_ttl } from '../src/scripts/consent.ts';

const now = 1_800_000_000_000;
assert.equal(parse_consent(null, now), null);
for (const value of ['{', '{}', '{"version":2,"analytics":true,"saved":1}', JSON.stringify({ version: 1, analytics: 'true', saved: now }), JSON.stringify({ version: 1, analytics: true, saved: now + 1 }), JSON.stringify({ version: 1, analytics: true, saved: now - consent_ttl })]) assert.equal(parse_consent(value, now), null);
assert.deepEqual(parse_consent(JSON.stringify({ version: 1, analytics: false, saved: now }), now), { version: 1, analytics: false, saved: now });
const approved = { PUBLIC_SITE_MODE: 'production', PUBLIC_LEGAL_APPROVED: 'true', PUBLIC_ANALYTICS_ENABLED: 'true', PUBLIC_METRICA_ID: '12345' };
assert.equal(make_site_config(approved).analytics_enabled, false, 'Env не снимает запрет черновиков');
assert.equal(make_site_config(approved, true).analytics_enabled, true);
assert.equal(make_site_config({ ...approved, PUBLIC_SITE_MODE: 'staging' }, true).analytics_enabled, false);
assert.equal(make_site_config({ ...approved, PUBLIC_METRICA_ID: '' }, true).analytics_enabled, false);
assert.equal(make_site_config({ ...approved, PUBLIC_METRICA_ID: '0' }, true).analytics_enabled, false);
assert.equal(make_site_config({ ...approved, PUBLIC_LEGAL_APPROVED: 'false' }, true).indexable, false);
assert.throws(() => make_site_config({ PUBLIC_SITE_URL: 'https://user:secret@example.com/path' }));
assert.throws(() => make_site_config({ PUBLIC_SITE_URL: 'http://example.com' }));

function fixture({ enabled = true, id = '12345', choice = false, origin = 'https://ses-dv.ru' } = {}) {
  const handlers = {};
  const scripts = [];
  const calls = [];
  let permission = choice;
  const window = {
    addEventListener(name, callback) { (handlers[name] ||= []).push(callback); },
    ym(...args) { calls.push(args); },
  };
  const storage = {};
  const document = {
    cookie: '_ym_uid=example; unrelated=safe',
    hidden: false,
    querySelector(selector) {
      if (selector === '[data-cookie-banner]') return { dataset: { analyticsAvailable: String(enabled), metricaId: id, siteOrigin: 'https://ses-dv.ru' } };
      if (selector === 'link[rel="canonical"]') return { href: 'https://ses-dv.ru/contacts' };
      return null;
    },
    addEventListener() {},
    createElement() { return { removed: false, remove() { this.removed = true; } }; },
    head: { append(script) { scripts.push(script); } },
  };
  const source = ts.transpileModule(readFileSync(new URL('../src/scripts/analytics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {}, require: () => ({ read_consent: () => permission ? { analytics: true } : null }), window, document, location: { origin, hostname: 'ses-dv.ru' }, localStorage: storage, Element: class {}, Date, Number, Object, Set };
  vm.runInNewContext(source, sandbox);
  sandbox.exports.init_analytics();
  return { scripts, calls, set(value) { permission = value; for (const fn of handlers['ses:consent'] || []) fn({}); }, goal(goal, extra = {}) { for (const fn of handlers['ses:goal'] || []) fn({ detail: { goal, ...extra } }); } };
}
for (const options of [{ enabled: false, choice: true }, { id: '', choice: true }, { choice: false }, { choice: true, origin: 'https://staging.example.test' }]) {
  const f = fixture(options); assert.equal(f.scripts.length, 0); f.goal('lead_success'); assert.equal(f.calls.length, 0);
}
const f = fixture({ choice: true });
assert.equal(f.scripts.length, 1);
assert.equal(f.calls.length, 0, 'До загрузки нет инициализации');
f.scripts[0].onload();
assert.equal(f.calls[0][1], 'init');
assert.equal(f.calls[0][2].webvisor, true); // решение владельца 2026-11-20: вебвизор и карта кликов включены (только после согласия)
assert.equal(f.calls[0][2].clickmap, true);
for (const key of ['trackLinks', 'accurateTrackBounce', 'trackHash', 'ecommerce', 'sendTitle']) assert.equal(f.calls[0][2][key], false);
assert.equal(f.calls[0][2].defer, true);
assert.equal(f.calls[0][2].disableYtm, true);
assert.equal(f.calls[1][2], 'https://ses-dv.ru/contacts');
assert.equal(f.calls[1][3].referer, '');
f.goal('lead_success', { name: 'SYNTHETIC TEST', phone: 'SYNTHETIC TEST' });
assert.deepEqual(f.calls.at(-1), [12345, 'reachGoal', 'lead_success']);
const before = f.calls.length;
f.goal('arbitrary-goal'); f.goal({ name: 'lead_success' }); assert.equal(f.calls.length, before);
f.set(false); assert.equal(f.calls.at(-1)[1], 'destruct');
const stopped = f.calls.length; f.goal('lead_success'); assert.equal(f.calls.length, stopped);
const race = fixture({ choice: true });
race.set(false); race.set(true);
race.scripts[0].onload(); assert.equal(race.calls.length, 0, 'Отменённая загрузка не инициализирует счётчик');
race.scripts[1].onload(); assert.equal(race.calls.filter((c) => c[1] === 'init').length, 1);
console.log('test-privacy: OK — consent expiry/version, env/legal gates, no consent/no ID/staging, PII-free goals, revoke and loading race');

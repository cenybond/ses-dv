// Проверка реального собранного consent-интерфейса в существующем Edge/Chrome.
// Положительная загрузка Метрики проверяется mocks в test-privacy; здесь только staging.
import assert from 'node:assert/strict';
import { create_staging_server } from './serve-staging.mjs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = [process.env.BROWSER_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
const executable = candidates.find(existsSync);
assert.ok(executable, 'Нужен существующий Edge/Chrome');
const server = create_staging_server();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const response = await fetch(origin + '/cookies');
assert.equal(response.status, 200);
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.equal(response.headers.get('x-frame-options'), 'DENY');
assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
const csp = response.headers.get('content-security-policy');
for (const rule of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"]) assert.ok(csp.includes(rule), 'CSP: ' + rule);
assert.ok(!csp.includes("'unsafe-eval'") && !csp.includes("'unsafe-inline'"));
const profile = await mkdtemp(join(tmpdir(), 'ses-consent-'));
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = (duration) => new Promise((done) => setTimeout(done, duration));
let ws;
const findings = [];
const requests = new Set();
const logs = [];
try {
  let url;
  for (let attempt = 0; attempt < 100 && !url; attempt++) {
    await sleep(100);
    try {
      const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
      url = tabs.find((tab) => tab.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* Ожидаем только собственный процесс. */ }
  }
  assert.ok(url, 'Нет CDP соединения');
  ws = new WebSocket(url);
  await new Promise((done, reject) => { ws.onopen = done; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id); pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.done(message.result);
    }
    if (message.method === 'Network.requestWillBeSent') requests.add(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') logs.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') logs.push(message.params.entry.text);
  };
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = ++seq;
    pending.set(id, { done, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const press = async (key, code, vk) => {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {}) });
    await sleep(50);
  };
  for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await send(domain + '.enable');
  // Даже ошибка теста не должна приводить к реальной внешней доставке.
  await send('Network.setBlockedURLs', { urls: ['*://mc.yandex.ru/*', '*://mc.yandex.com/*', '*://*.yandex.ru/*'] });
  const shots = join(root, 'artifacts', 'screenshots');
  await mkdir(shots, { recursive: true });
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: origin + '/cookies' });
    await sleep(300);
    await evaluate('new Promise(r => document.readyState === "complete" ? r(true) : addEventListener("load", () => r(true), { once: true }))');
    await evaluate('document.fonts.ready.then(() => true)');
    await evaluate('localStorage.removeItem("ses-consent")');
    assert.equal(await evaluate('document.querySelector("[data-cookie-banner]").hidden'), true);
    assert.equal(await evaluate('document.querySelector("#cookie-analytics").disabled'), true);
    await evaluate('document.querySelector("[data-cookie-settings]").focus()');
    await press('Enter', 'Enter', 13);
    assert.equal(await evaluate('document.querySelector("#cookie-settings").open'), true);
    assert.equal(await evaluate('document.querySelector("#cookie-settings").contains(document.activeElement)'), true);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true);
    const bounds = await evaluate('(() => {const r=document.querySelector("#cookie-settings").getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}})()');
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.top >= 0 && bounds.bottom <= bounds.height + 1);
    const picture = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(shots, 'cookies-' + width + '.png'), Buffer.from(picture.data, 'base64'));
    for (let count = 0; count < 8; count++) {
      await press('Tab', 'Tab', 9);
      assert.equal(await evaluate('document.querySelector("#cookie-settings").contains(document.activeElement)'), true, 'Tab не должен уходить в фон');
    }
    await press('Escape', 'Escape', 27);
    assert.equal(await evaluate('document.querySelector("#cookie-settings").open'), false);
    assert.equal(await evaluate('document.activeElement.hasAttribute("data-cookie-settings")'), true);
    await press('Enter', 'Enter', 13);
    await evaluate('document.querySelector("[data-cookie-save]").focus()');
    await press('Enter', 'Enter', 13);
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("ses-consent")).analytics'), false);
    assert.equal(await evaluate('document.querySelector("#cookie-settings").open'), false);
    assert.equal(await evaluate('document.activeElement.hasAttribute("data-cookie-settings")'), true);
    await press('Enter', 'Enter', 13);
    await evaluate('document.querySelector("#cookie-settings [data-cookie-reject]").focus()');
    await press('Enter', 'Enter', 13);
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("ses-consent")).version'), 1);
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("ses-consent")).analytics'), false);
    findings.push({ width, settings: 'keyboard open/save/reject/Escape/focus trap+restore OK', screenshot: 'cookies-' + width + '.png' });
  }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__metrics = { lcp: null, cls: 0 }; new PerformanceObserver(list => { for (const item of list.getEntries()) window.__metrics.lcp = item.startTime; }).observe({type:'largest-contentful-paint', buffered:true}); new PerformanceObserver(list => { for (const item of list.getEntries()) if (!item.hadRecentInput) window.__metrics.cls += item.value; }).observe({type:'layout-shift', buffered:true});` });
  const metrics = [];
  for (const width of [390, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: origin + '/' });
    await sleep(900);
    await evaluate('document.fonts.ready.then(() => true)');
    metrics.push({ width, ...await evaluate(`(() => { const nav=performance.getEntriesByType('navigation')[0]; const resources=performance.getEntriesByType('resource'); return { ...window.__metrics, dom_content_loaded_ms: nav.domContentLoadedEventEnd, load_ms: nav.loadEventEnd, response_start_ms: nav.responseStart, transfer_bytes: nav.transferSize + resources.reduce((n,r)=>n+r.transferSize,0), decoded_bytes: nav.decodedBodySize + resources.reduce((n,r)=>n+r.decodedBodySize,0), resources: resources.length }; })()`) });
  }
  const reflow = [];
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const path of ['/', '/contacts']) {
    await send('Page.navigate', { url: origin + path });
    await sleep(400);
    await evaluate('document.fonts.ready.then(() => true)');
    await evaluate('document.documentElement.style.zoom = "2"');
    await sleep(150);
    const result = await evaluate(`({scroll_width:document.documentElement.scrollWidth,client_width:document.documentElement.clientWidth,body_width:document.body.getBoundingClientRect().width,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<0)}).slice(0,8).map(el=>({tag:el.tagName,class:typeof el.className==='string'?el.className:'',width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}))})`);
    reflow.push({ path, method: 'CSS zoom=2, не browser UI zoom', ...result, overflow: result.scroll_width > result.client_width + 1 });
    await evaluate('document.documentElement.style.zoom = ""');
  }
  await writeFile(join(root, 'artifacts', 'browser-metrics.json'), JSON.stringify({ tested: new Date().toISOString(), environment: 'Локальный HTTP, прогретый браузер Edge, без CPU/network throttling. Не Lighthouse и не полевые Core Web Vitals.', metrics, reflow, limits: ['LCP/CLS — короткие локальные наблюдения до взаимодействия.', 'CSS zoom приближает масштабирование; browser UI zoom и screen reader не проверены.'] }, null, 2));
  const external = [...requests].filter((url) => !url.startsWith(origin + '/') && !url.startsWith('data:'));
  assert.deepEqual(external, [], 'Внешних запросов быть не должно');
  assert.deepEqual(logs, [], 'Ошибки JS/CSP');
  await writeFile(join(shots, 'cookies-verification.json'), JSON.stringify({ tested: new Date().toISOString(), findings, external_requests: external, console_errors: logs, csp, limits: ['Реальный SDK и цели проверены только mocks; счётчик не подключён.', 'Screen reader и реальные устройства не проверены.'] }, null, 2));
  console.log('check-consent-browser: OK — 390/1440, keyboard/dialog/storage, no external requests, restrictive CSP/security headers; screenshots saved');
  console.log(JSON.stringify({ metrics, reflow }));
} finally {
  ws?.close();
  browser.kill();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await sleep(300);
  // Удаляется только созданный этим тестом временный профиль, не профиль пользователя.
  const temporary = resolve(tmpdir()) + sep;
  if (!resolve(profile).startsWith(temporary) || !profile.includes('ses-consent-')) throw new Error('Небезопасный путь временного профиля');
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(() => {});
}

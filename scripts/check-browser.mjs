// Браузерная проверка собранного сайта (dist/) без Playwright: Edge/Chrome headless по CDP, встроенные http-сервер и WebSocket Node.
// На ширинах 320 / 390 / 768 / 1440: нет горизонтальной прокрутки, нет элементов за границей окна, нет ошибок консоли и сети,
// нет запросов вне локального сервера, загружены Manrope и Golos Text, все логотипы отрисованы, клавиатурный обход
// (skip-link первым, видимый контур у каждого сфокусированного элемента, Enter на skip-link переводит фокус на <main>).
// Использование: node scripts/check-browser.mjs [--shots <папка>] [--page /] [--base http://localhost:4321]; браузер: переменная BROWSER_PATH или стандартные пути Windows.
// С --base проверяется уже запущенный сервер (например, dev), иначе поднимается свой сервер для dist/.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const shotsDir = opt('--shots');
const pagePath = opt('--page') ?? '/';
const base = opt('--base');
const WIDTHS = [320, 390, 768, 1440];
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

if (!base && !existsSync(dist)) throw new Error('dist/ не найден: сначала npm run build');

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Edge/Chrome не найден: задайте BROWSER_PATH');
  return found;
}

// --- статический сервер для dist/
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(dist, p));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end('not found');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
if (!base) await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = base ?? `http://127.0.0.1:${server.address().port}`;

// --- браузер
const profile = await mkdtemp(join(tmpdir(), 'ses-browser-'));
const browser = spawn(findBrowser(), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu',
  '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 100));
  try {
    const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* ждём запуска */ }
}
if (!wsUrl) throw new Error('не удалось подключиться к браузеру');

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pendingCalls = new Map();
const listeners = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pendingCalls.has(msg.id)) {
    const { resolve, reject } = pendingCalls.get(msg.id);
    pendingCalls.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  } else listeners.forEach((l) => l(msg));
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pendingCalls.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};

const errors = [];
const fail = (m) => errors.push(m);
let ctx = '';
const requests = new Set();
listeners.push((msg) => {
  const { method, params } = msg;
  if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(params.type)) {
    fail(`${ctx}: console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (method === 'Runtime.exceptionThrown') {
    fail(`${ctx}: исключение: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
  } else if (method === 'Log.entryAdded' && ['error', 'warning'].includes(params.entry.level)) {
    fail(`${ctx}: ${params.entry.level}: ${params.entry.text} ${params.entry.url ?? ''}`);
  } else if (method === 'Network.requestWillBeSent') {
    requests.add(params.request.url);
    if (!params.request.url.startsWith(origin) && !params.request.url.startsWith('data:')) fail(`${ctx}: внешний запрос ${params.request.url}`);
  } else if (method === 'Network.responseReceived' && params.response.status >= 400) {
    fail(`${ctx}: HTTP ${params.response.status} ${params.response.url}`);
  } else if (method === 'Network.loadingFailed') {
    fail(`${ctx}: загрузка не удалась: ${params.errorText} ${params.requestId}`);
  }
});
for (const d of ['Page', 'Runtime', 'Network', 'Log']) await send(`${d}.enable`);

const report = [];
const press = async (key, code, vk) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
};

try {
  for (const width of WIDTHS) {
    ctx = `${pagePath} @${width}`;
    await send('Emulation.setDeviceMetricsOverride', { width, height: width >= 768 ? 900 : 844, deviceScaleFactor: 1, mobile: width < 768 });
    requests.clear();
    await send('Page.navigate', { url: origin + pagePath });
    await new Promise((r) => setTimeout(r, 300));
    await evaluate('document.fonts.ready.then(() => true)');
    await evaluate('new Promise(r => document.readyState === "complete" ? r(true) : addEventListener("load", () => r(true)))');

    const m = await evaluate(`(() => {
      const de = document.documentElement, W = ${width};
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        return r.width > 0 && cs.position !== 'fixed' && (r.right > W + 1 || r.left < -1);
      }).slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' [' + Math.round(el.getBoundingClientRect().left) + '…' + Math.round(el.getBoundingClientRect().right) + ']');
      const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
      const imgs = [...document.images].map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 }));
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, bodyScrollW: document.body.scrollWidth, wide, fonts, imgs,
        h1: document.querySelectorAll('h1').length, headerFont: getComputedStyle(document.querySelector('h1,h2')).fontFamily,
        bodyFont: getComputedStyle(document.body).fontFamily };
    })()`);
    if (m.scrollW > m.clientW) fail(`${ctx}: горизонтальная прокрутка (scrollWidth ${m.scrollW} > ${m.clientW})`);
    if (m.wide.length) fail(`${ctx}: элементы за границей окна: ${m.wide.join(', ')}`);
    for (const fam of ['Manrope', 'Golos Text']) if (!m.fonts.includes(fam)) fail(`${ctx}: шрифт ${fam} не загружен (загружены: ${m.fonts.join(', ') || 'нет'})`);
    for (const i of m.imgs) if (!i.ok) fail(`${ctx}: изображение не отрисовано: ${i.src}`);
    report.push(`${width}px: scrollWidth ${m.scrollW}/${m.clientW}, шрифты: ${[...new Set(m.fonts)].join(' + ')}, изображений ${m.imgs.length}, запросов ${requests.size}`);

    if (shotsDir && (width === 1440 || width === 390)) {
      await mkdir(shotsDir, { recursive: true });
      const top = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(shotsDir, `foundation-${width}-first-screen.png`), Buffer.from(top.data, 'base64'));
      const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(join(shotsDir, `foundation-${width}-full.png`), Buffer.from(full.data, 'base64'));
    }
  }

  // клавиатура: десктоп и телефон
  const focusInfo = `(() => { const a = document.activeElement; const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
    return { tag: a.tagName.toLowerCase(), cls: a.className, text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
      outline: cs.outlineStyle + ' ' + cs.outlineWidth, visible: r.width > 0 && r.height > 0 }; })()`;
  for (const width of [1440, 390]) {
    ctx = `${pagePath} клавиатура @${width}`;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    await send('Page.navigate', { url: origin + pagePath });
    await new Promise((r) => setTimeout(r, 400));
    const order = [];
    let sawBurger = false;
    for (let i = 0; i < 12; i++) {
      await press('Tab', 'Tab', 9);
      const f = await evaluate(focusInfo);
      order.push(`${f.tag}${f.cls ? '.' + String(f.cls).split(' ')[0] : ''} «${f.text}»`);
      if (f.tag === 'body') break;
      if (!f.visible) fail(`${ctx}: фокус на невидимом элементе ${f.tag}.${f.cls}`);
      if (f.outline.startsWith('none') || parseFloat(f.outline.split(' ')[1]) < 2) fail(`${ctx}: нет видимого контура у ${f.tag}.${f.cls} (${f.outline})`);
      if (i === 0 && !String(f.cls).includes('skip')) fail(`${ctx}: первым в обходе не skip-link, а ${f.tag}.${f.cls}`);
      if (String(f.cls).includes('burger')) { sawBurger = true; break; }
    }
    if (width < 960 && !sawBurger) fail(`${ctx}: бургер недоступен с клавиатуры`);
    if (width >= 960 && order.some((o) => o.includes('burger'))) fail(`${ctx}: бургер в обходе на десктопе`);
    if (sawBurger) {
      await press('Enter', 'Enter', 13); // без диалога меню (DEMO-05) бургер — якорь на навигацию подвала
      await new Promise((r) => setTimeout(r, 150));
      if ((await evaluate('document.activeElement.id')) !== 'site-nav') fail(`${ctx}: Enter на бургере не ведёт к навигации подвала`);
    }
    await send('Page.navigate', { url: origin + pagePath });
    await new Promise((r) => setTimeout(r, 400));
    await press('Tab', 'Tab', 9);
    await press('Enter', 'Enter', 13);
    await new Promise((r) => setTimeout(r, 100));
    if ((await evaluate('document.activeElement.id')) !== 'main') fail(`${ctx}: Enter на skip-link не переводит фокус на <main>`);
    report.push(`обход Tab @${width}: ${order.join(' → ')}`);
  }
} finally {
  ws.close();
  browser.kill();
  server.close();
  await new Promise((r) => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

console.log(report.join('\n'));
if (errors.length) {
  console.error([...new Set(errors)].map((e) => `✗ ${e}`).join('\n'));
  console.error(`\ncheck-browser: ${new Set(errors).size} ошибок`);
  process.exit(1);
}
console.log(`check-browser: OK — ${WIDTHS.join(' / ')} px, консоль и сеть чистые, внешних запросов нет`);

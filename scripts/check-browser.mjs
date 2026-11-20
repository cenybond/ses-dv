// Браузерная проверка собранного сайта (dist/) без Playwright: Edge/Chrome headless по CDP, встроенные http-сервер и WebSocket Node.
// Все страницы демо на ширинах 320 / 390 / 768 / 1024 / 1440: нет горизонтальной прокрутки и элементов за границей окна, нет ошибок консоли и сети,
// нет запросов вне локального сервера, загружены Manrope и Golos Text, логотипы отрисованы, у ссылок и кнопок есть имена, цели касания ≥ 44 px,
// одна оболочка (header, main, footer, skip-link; у 404 оболочки нет), шапка не перекрывает заголовок, меню/бургер/CTA показаны по ширине, нижней панели нет.
// Сценарии (DEMO-04): клавиатурный обход и skip-link; desktop — пункты шапки, aria-current, CTA, логотип, подвал; mobile — шторка меню
// (Esc, возврат фокуса, ловушка фокуса, фон, повторное открытие без дублей обработчиков); на главной пункты меню и CTA прокручивают к разделам;
// режим без JavaScript (якорь #site-nav, меню шапки); шторка на 768 и 1024.
// Использование: node scripts/check-browser.mjs [--shots <папка>] [--page /about] [--base http://localhost:4321]; браузер: переменная BROWSER_PATH или стандартные пути Windows.
// С --base проверяется уже запущенный сервер (например, dev), иначе поднимается свой сервер для dist/.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const shotsDir = opt('--shots');
const pagePath = opt('--page'); // без --page проверяются все страницы демо
const base = opt('--base');
const WIDTHS = [320, 390, 768, 1024, 1440];
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
if (!wsUrl) { browser.kill(); server.close(); throw new Error('не удалось подключиться к браузеру'); }

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pendingCalls = new Map();
const listeners = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pendingCalls.has(msg.id)) {
    const { resolve, reject, timer } = pendingCalls.get(msg.id);
    clearTimeout(timer);
    pendingCalls.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
  } else listeners.forEach((l) => l(msg));
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => { pendingCalls.delete(id); reject(new Error(`${method}: превышено время ожидания`)); }, 15000);
  pendingCalls.set(id, { resolve, reject, timer });
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
const requestUrls = new Map();
let lastNavigation = 0;
// Карта контактов на главной (PROD-23) — iframe Яндекса: его запросы, предупреждения и ошибки не относятся к коду сайта и не проверяются.
const yandexIds = new Set();
const isYandex = (text) => /yandex\.(?:ru|net|com)|yastatic\.net/i.test(String(text ?? ''));
listeners.push((msg) => {
  const { method, params } = msg;
  if (method === 'Network.requestWillBeSent' || method === 'Network.responseReceived' || method === 'Network.loadingFailed') {
    const url = params.request?.url ?? params.response?.url;
    if (isYandex(url)) yandexIds.add(params.requestId);
    if (yandexIds.has(params.requestId)) return;
  }
  if (method === 'Log.entryAdded' && (isYandex(params.entry.text) || isYandex(params.entry.url))) return;
  if (method === 'Runtime.consoleAPICalled' && params.args.some((a) => isYandex(a.value ?? a.description))) return;
  if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(params.type)) {
    fail(`${ctx}: console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (method === 'Runtime.exceptionThrown') {
    // Встроенные расширения Edge изредка бросают это при отключённом JS страницы — к коду сайта не относится.
    const text = params.exceptionDetails.exception?.description ?? params.exceptionDetails.text ?? '';
    if (text.includes('Receiving end does not exist')) return;
    fail(`${ctx}: исключение: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`);
  } else if (method === 'Log.entryAdded' && ['error', 'warning'].includes(params.entry.level)) {
    fail(`${ctx}: ${params.entry.level}: ${params.entry.text} ${params.entry.url ?? ''}`);
  } else if (method === 'Network.requestWillBeSent') {
    requestUrls.set(params.requestId, params.request.url);
    requests.add(params.request.url);
    if (!params.request.url.startsWith(origin) && !params.request.url.startsWith('data:') && !params.request.url.startsWith('chrome-extension:')) fail(`${ctx}: внешний запрос ${params.request.url}`);
  } else if (method === 'Network.responseReceived' && params.response.status >= 400) {
    fail(`${ctx}: HTTP ${params.response.status} ${params.response.url}`);
  } else if (method === 'Page.frameStartedLoading') {
    lastNavigation = Date.now();
  } else if (method === 'Network.loadingFailed') {
    // запрос оборван уходом со страницы (клик по ссылке, navigate) — не ошибка сайта
    if (params.errorText === 'net::ERR_ABORTED' && Date.now() - lastNavigation < 1500) return;
    fail(`${ctx}: загрузка не удалась: ${params.errorText} ${requestUrls.get(params.requestId) ?? params.requestId}`);
  }
});
for (const d of ['Page', 'Runtime', 'Network', 'Log']) await send(`${d}.enable`);
// Карта Яндекса на главной (PROD-23) не относится к коду сайта и зависит от чужой сети: её запросы блокируются, чтобы страница загружалась детерминированно.
await send('Network.setBlockedURLs', { urls: ['*://yandex.ru/*', '*://*.yandex.ru/*', '*://*.yandex.net/*', '*://yastatic.net/*'] });

const report = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (key, code, vk) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
};
// Опрос условия (до 2 с): медиа-запросы и события обновляются на следующем кадре, а не мгновенно.
const until = (expression) => evaluate(`new Promise((resolve) => { const t0 = Date.now(); const tick = () => { if (${expression}) resolve(true); else if (Date.now() - t0 > 2000) resolve(false); else setTimeout(tick, 50); }; tick(); })`);
// То же с большим запасом: прокрутка к разделу по ссылке (0,3 с + 1,7 с) на нагруженной машине идёт дольше двух секунд.
const untilLong = (expression, ms = 9000) => evaluate(`new Promise((resolve) => { const t0 = Date.now(); const tick = () => { if (${expression}) resolve(true); else if (Date.now() - t0 > ${ms}) resolve(false); else setTimeout(tick, 100); }; tick(); })`);
// Страница после клика по ссылке загружена: документ готов и есть <h1> (фиксированная пауза давала гонку).
const settled = async () => {
  await sleep(150);
  await until(`document.readyState === 'complete' && !!document.querySelector('h1')`);
};
const view = (width, height = width >= 768 ? 900 : 844) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  window.__listeners = {};
  const orig = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (this instanceof Element) {
      const key = this.localName + (this.id ? '#' + this.id : '') + (typeof this.className === 'string' && this.className ? '.' + this.className.split(' ')[0] : '') + ':' + type;
      window.__listeners[key] = (window.__listeners[key] || 0) + 1;
    }
    return orig.call(this, type, ...rest);
  };
})()` });
const go = async (path) => {
  await send('Page.navigate', { url: origin + path });
  await sleep(350);
  if (!await until(`document.readyState === 'complete'`)) throw new Error(`Не загружена страница ${path}`);
  await evaluate('document.fonts.ready.then(() => true)');
};
const shot = async (name, clip) => {
  if (!shotsDir) return;
  await mkdir(shotsDir, { recursive: true });
  const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  await writeFile(join(shotsDir, `${name}.png`), Buffer.from(r.data, 'base64'));
  if (args.includes('--full-shots') && /-(390|1440)$/.test(name)) {
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 } });
    await writeFile(join(shotsDir, `${name}-full.png`), Buffer.from(full.data, 'base64'));
  }
};
const focusInfo = `(() => { const a = document.activeElement; const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
  return { tag: a.tagName.toLowerCase(), cls: a.className, id: a.id, text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
    outline: cs.outlineStyle + ' ' + cs.outlineWidth, visible: r.width > 0 && r.height > 0, inMenu: !!a.closest('#menu') }; })()`;
const expectEq = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${ctx}: ${what}: ${JSON.stringify(actual)} вместо ${JSON.stringify(expected)}`);
};

// Контракт оболочки: что должно быть на каждой странице. Подписи — из данных (src/data/ui.ts), пути — из src/data/nav.ts.
const { ui } = await import(pathToFileURL(join(root, 'src/data/ui.ts')).href);
const { mainNav, routes, vacanciesExternalUrl } = await import(pathToFileURL(join(root, 'src/data/nav.ts')).href);
const { published_routes } = await import(pathToFileURL(join(root, 'src/data/publications.ts')).href);
const walkpages = dir => readdirSync(dir).flatMap(name => { const file = join(dir, name); return statSync(file).isDirectory() ? walkpages(file) : file.endsWith('.html') ? [file] : []; });
// Адреса разделов, списков и проектов (/services/all, /projects/nadezhda…) — копии главной (PROD-22): в общем обходе только /services и /projects, остальные проверяет сценарий «адреса главной».
const PAGES = pagePath ? [pagePath] : walkpages(dist).map(file => '/' + file.slice(dist.length + 1).replaceAll('\\', '/').replace(/(?:^|\/)index\.html$/, '')).filter(path => !/^\/(services|projects)\/./.test(path));
const headernav = [{ href: '/', label: 'Главная' }, ...mainNav];

try {
  // --- 1. каждая страница на каждой ширине: нет прокрутки вбок, шрифты, логотипы, одна оболочка, доступные имена
  for (const path of PAGES) {
    for (const width of WIDTHS) {
      ctx = `${path} @${width}`;
      await view(width);
      requests.clear();
      await go(path);

      const m = await evaluate(`(() => {
        const de = document.documentElement, W = ${width};
        // Элемент внутри предка с обрезкой (overflow hidden/clip, например бегущая лента заказчиков) за край не выходит — его не считаем.
        const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'clip') { const r = p.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1) return true; } } return false; };
        const wide = [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          return r.width > 0 && cs.position !== 'fixed' && (r.right > W + 1 || r.left < -1) && !el.closest('dialog:not([open])') && !clipped(el);
        }).slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' [' + Math.round(el.getBoundingClientRect().left) + '…' + Math.round(el.getBoundingClientRect().right) + ']');
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
        // Ленивые фото (окна проектов, плитки ниже экрана) грузятся по мере надобности — проверяем только обычные.
        const imgs = [...document.images].filter((i) => i.loading !== 'lazy' && !i.closest('dialog:not([open])')).map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 }));
        const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
        const unnamed = [...document.querySelectorAll('a[href], button')].filter((el) => visible(el) && !(el.getAttribute('aria-label') || el.textContent.trim() || el.querySelector('img[alt]:not([alt=""])')))
          .map((el) => el.tagName.toLowerCase() + '.' + el.className);
        const small = [...document.querySelectorAll('.nav a, .burger, .btn, .menu-list a, .footer__col a, .modal__close')].filter(visible)
          // Подвал: пункты высотой --space-8 на десктопе и на телефоне ≤ 640 px (решение владельца 2026-11-19); текстовая ссылка проверяется по высоте строки, не по ширине слова.
          .filter((el) => !((window.innerWidth > 1024 || window.innerWidth <= 640) && el.matches('.footer__col a')))
          .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || (r.width < 43.5 && !el.matches('.footer__col a')); }).map((el) => el.className + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));
        const navLabels = [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') || '');
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide, fonts, imgs, unnamed, small, navLabels,
          h1: document.querySelectorAll('h1').length, mains: document.querySelectorAll('main').length, headers: document.querySelectorAll('body > header').length,
          footers: document.querySelectorAll('body > footer').length, skip: document.querySelectorAll('a.skip').length,
          lang: de.lang, robots: document.querySelector('meta[name=robots]')?.content,
          burger: visible(document.querySelector('.burger')), nav: visible(document.querySelector('.nav')), dock: !!document.querySelector('.dock'),
          cta: visible(document.querySelector('.site-header__actions .btn')), phone: visible(document.querySelector('.header-phone')),
          bare: document.body.classList.contains('page-bare'),
          h1Top: document.querySelector('h1')?.getBoundingClientRect().top ?? 0, headerBottom: document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0 };
      })()`);
      if (m.scrollW > m.clientW) fail(`${ctx}: горизонтальная прокрутка (scrollWidth ${m.scrollW} > ${m.clientW})`);
      if (m.wide.length) fail(`${ctx}: элементы за границей окна: ${m.wide.join(', ')}`);
      for (const fam of ['Manrope', 'Golos Text']) if (!m.fonts.includes(fam)) fail(`${ctx}: шрифт ${fam} не загружен (загружены: ${m.fonts.join(', ') || 'нет'})`);
      for (const i of m.imgs) if (!i.ok) fail(`${ctx}: изображение не отрисовано: ${i.src}`);
      if (m.unnamed.length) fail(`${ctx}: ссылки/кнопки без доступного имени: ${m.unnamed.join(', ')}`);
      if (m.small.length) fail(`${ctx}: цель касания меньше 44 px: ${m.small.join('; ')}`);
      expectEq('h1', m.h1, 1);
      expectEq('main', m.mains, 1);
      expectEq('lang', m.lang, 'ru');
      if (!m.robots?.includes('noindex')) fail(`${ctx}: staging должен быть noindex`);
      expectEq('нижней панели нет', m.dock, false);
      // 404 — отдельная страница без шапки, подвала и меню (решение владельца 2026-11-18): оболочку на ней не проверяем
      if (m.bare) {
        expectEq('страница без оболочки: нет header/footer', [m.headers, m.footers], [0, 0]);
      } else {
        expectEq('header/footer', [m.headers, m.footers, m.skip], [1, 1, 1]);
        if (new Set(m.navLabels).size !== m.navLabels.length || m.navLabels.some((l) => !l)) fail(`${ctx}: у <nav> нет уникальных подписей: ${JSON.stringify(m.navLabels)}`);
        if (m.h1Top < m.headerBottom - 0.5) fail(`${ctx}: шапка перекрывает заголовок (h1 ${Math.round(m.h1Top)} < шапка ${Math.round(m.headerBottom)})`);
        // видимость элементов оболочки по ширине: десктоп ≥ 961 — меню в шапке, мобильное — бургер
        expectEq('меню в шапке / бургер', [m.nav, m.burger], width > 960 ? [true, false] : [false, true]);
        expectEq('CTA «Связаться с нами» в шапке', m.cta, width > 960);
        expectEq('телефон в шапке', m.phone, width > 1180);
      }
      if (shotsDir && [390,1440].includes(width) && ['/', '/about', '/vacancies', '/contacts'].includes(path)) await shot((path === '/' ? 'home' : path.slice(1).replaceAll('/', '-')) + '-' + width);
      if (path === '/') report.push(`${width}px: scrollWidth ${m.scrollW}/${m.clientW}, шрифты: ${[...new Set(m.fonts)].join(' + ')}, изображений ${m.imgs.length}, запросов ${requests.size}`);
    }
    console.log(`checked ${path}: ${WIDTHS.length} widths`);
  }
  report.push(`страницы × ширины: ${PAGES.join(' ')} × ${WIDTHS.join('/')}`);

  // --- 2. клавиатура и skip-link: десктоп и телефон
  for (const width of [1440, 390]) {
    ctx = `клавиатура @${width}`;
    await view(width, 900);
    await go('/');
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
    if (width >= 960) {
      const wanted = [...mainNav.map((i) => i.label), ui.actions.contactUs];
      for (const label of wanted) if (!order.some((o) => o.includes(`«${label}»`))) fail(`${ctx}: «${label}» не достигается клавишей Tab (${order.join(' → ')})`);
    }
    await go('/');
    await press('Tab', 'Tab', 9);
    await press('Enter', 'Enter', 13);
    await sleep(100);
    if ((await evaluate('document.activeElement.id')) !== 'main') fail(`${ctx}: Enter на skip-link не переводит фокус на <main>`);
    report.push(`обход Tab @${width}: ${order.join(' → ')}`);
  }

  // --- 3. desktop 1440: навигация, активный пункт, CTA, логотип, подвал
  await view(1440, 900);
  ctx = 'desktop 1440';
  await go('/about');
  const desk = await evaluate(`(() => ({
    nav: [...document.querySelectorAll('.nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]),
    cta: [document.querySelector('.site-header__actions .btn').textContent.trim(), document.querySelector('.site-header__actions .btn').getAttribute('href')],
    phone: document.querySelector('.header-phone').getAttribute('href'), logo: document.querySelector('.site-header .logo').getAttribute('href'),
    solid: document.querySelector('.site-header').classList.contains('is-solid'),
    logoShown: [...document.querySelectorAll('.site-header .logo__img')].filter((i) => getComputedStyle(i).display !== 'none').map((i) => i.src.split('/').pop().split('.')[0]),
    footer: [...document.querySelectorAll('#site-nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]),
    vacancy: [...document.querySelectorAll('#site-nav a')].find((a) => a.textContent.includes('Вакансии'))?.getAttribute('href'),
  }))()`);
  expectEq('пункты шапки', desk.nav.map((n) => n[0]), headernav.map((i) => i.label));
  expectEq('ссылки шапки', desk.nav.map((n) => n[1]), headernav.map((i) => i.href));
  expectEq('aria-current в шапке на /about', desk.nav.map((n) => n[2]), [null, 'page', null, null, null]);
  expectEq('CTA шапки', desk.cta, [ui.actions.contactUs, routes.contacts]);
  expectEq('ссылка логотипа', desk.logo, routes.home);
  expectEq('логотип над светлой шапкой', desk.logoShown, ['logo-wordmark']);
  expectEq('телефон — tel:', desk.phone.startsWith('tel:+7'), true);
  expectEq('разделы подвала', desk.footer.map((f) => f[1]), [...mainNav.map((i) => i.href), vacanciesExternalUrl, ...published_routes.filter(path => path === '/news' || path === '/documents')]);
  expectEq('Вакансии в подвале ведут на hh.ru', desk.vacancy, vacanciesExternalUrl);
  await shot('header-desktop', { x: 0, y: 0, width: 1440, height: 200 });

  // переходы с внутренней страницы: пункт-страница открывает её и становится активным, пункт-раздел (/#…) ведёт на главную к разделу
  for (const item of mainNav) {
    await go('/cookies');
    await evaluate(`document.querySelector('.nav a[href="${item.href}"]').click()`);
    await settled();
    const r = await evaluate(`({ path: location.pathname.replace(/\\/$/, '') || '/', h1: !!document.querySelector('h1'), cur: document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') ?? null })`);
    // «Услуги» и «Проекты» — адреса-копии главной (PROD-22): страница открывается, а подчёркивание пункта следует за прокруткой к разделу.
    if ([routes.services, routes.projects].includes(item.href)) expectEq(`переход «${item.label}» к разделу главной`, [r.path, r.h1], [item.href, true]);
    else expectEq(`переход «${item.label}»`, [r.path, r.cur, r.h1], [item.href, item.href, true]);
  }
  await go('/about');
  await evaluate(`document.querySelector('.site-header .logo').click()`);
  await settled();
  expectEq('логотип ведёт на главную', await evaluate('location.pathname'), '/');
  // главная (решение владельца): пункты шапки плавно прокручивают к своим разделам этой же страницы, «Связаться с нами» — к блоку контактов внизу
  await go('/');
  await evaluate(`document.querySelector('.nav a[href="/about"]').click()`);
  expectEq('главная: «О нас» прокручивает к разделу без перехода', await until(`location.pathname === '/' && window.scrollY > 200`), true);
  await go('/');
  await evaluate(`document.querySelector('.site-header__actions .btn').click()`);
  expectEq('главная: CTA ведёт к блоку обращения', await until(`location.pathname === '/' && Math.abs(document.getElementById('request').getBoundingClientRect().top) < innerHeight`), true);
  // внутренняя страница: CTA «Связаться с нами» — обычная ссылка на страницу контактов
  await go('/about');
  await evaluate(`document.querySelector('.site-header__actions .btn').click()`);
  expectEq('CTA ведёт на страницу контактов', await until(`location.pathname === '/contacts'`), true);
  await go('/cookies');
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(300);
  await shot('footer-desktop');
  report.push('desktop 1440: пункты шапки, активный пункт, CTA, логотип, подвал, «Вакансии» доступны');

  // --- 4. mobile 390: шторка меню, нижняя панель
  await view(390, 844);
  ctx = 'mobile 390';
  await go('/about');
  await shot('header-mobile', { x: 0, y: 0, width: 390, height: 180 });
  await shot('menu-closed-mobile');
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(300);
  await shot('footer-mobile-end');
  await evaluate('window.scrollTo(0, 0)');

  // открытие с клавиатуры: skip → логотип → бургер → Enter
  for (let i = 0; i < 3; i++) await press('Tab', 'Tab', 9);
  expectEq('третий Tab — бургер', (await evaluate(focusInfo)).cls.split(' ')[0], 'burger');
  await press('Enter', 'Enter', 13);
  await sleep(250);
  const open = await evaluate(`(() => { const m = document.querySelector('#menu'); const b = document.querySelector('.burger'); const de = document.documentElement;
    return { open: m.open, modal: m.matches(':modal'), active: document.activeElement.className, inMenu: !!document.activeElement.closest('#menu'), expanded: b.getAttribute('aria-expanded'),
      role: b.getAttribute('role'), overflow: getComputedStyle(de).overflow, hScroll: de.scrollWidth > de.clientWidth,
      items: [...m.querySelectorAll('.menu-list a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]),
      cta: [m.querySelector('.btn').textContent.trim(), m.querySelector('.btn').getAttribute('href')], navLabel: m.querySelector('nav').getAttribute('aria-label') }; })()`);
  expectEq('шторка: открыта как модальная, фокус на кнопке закрытия внутри неё', [open.open, open.modal, open.inMenu, open.active.split(' ')[0]], [true, true, true, 'modal__close']);
  expectEq('шторка: aria-expanded у кнопки «Меню»', [open.expanded, open.role], ['true', 'button']);
  expectEq('шторка: фон не прокручивается', ['hidden', 'clip'].includes(open.overflow), true);
  if (open.hScroll) fail(`${ctx}: горизонтальная прокрутка при открытом меню`);
  expectEq('шторка: пункты', open.items.map((i) => [i[0], i[1]]), mainNav.map((i) => [i.label, i.href]));
  expectEq('шторка: активный раздел «О нас»', open.items.map((i) => i[2]), ['page', null, null, null]);
  expectEq('шторка: кнопка заявки', open.cta, [ui.actions.contactUs, routes.contacts]);
  await shot('menu-open-mobile');
  // ловушка фокуса: 14 нажатий Tab и 3 Shift+Tab, фокус всё время в шторке
  let leaked = false;
  for (let i = 0; i < 14; i++) { await press('Tab', 'Tab', 9); const f = await evaluate(focusInfo); if (!f.inMenu && f.tag !== 'body') leaked = true; }
  if (leaked) fail(`${ctx}: фокус вышел за пределы шторки при Tab`);
  await press('Escape', 'Escape', 27);
  // закрытие плавное (анимация до 500 мс, mobile-menu.ts) — ждём, пока диалог закроется и фокус вернётся
  await untilLong(`!document.querySelector('#menu').open && document.activeElement.classList.contains('burger') && document.querySelector('.burger').getAttribute('aria-expanded') === 'false'`);
  const closed = await evaluate(`({ open: document.querySelector('#menu').open, active: document.activeElement.className.split(' ')[0], expanded: document.querySelector('.burger').getAttribute('aria-expanded'), overflow: getComputedStyle(document.documentElement).overflow })`);
  expectEq('Escape закрывает шторку, фокус возвращается на «Меню»', [closed.open, closed.active, closed.expanded, ['hidden', 'clip'].includes(closed.overflow)], [false, 'burger', 'false', false]);
  // повторное открытие: кнопкой закрытия, потом кликом по фону. Обработчики регистрируются один раз и не множатся при открытиях
  const listeners = () => evaluate('JSON.stringify(window.__listeners)');
  const before = await listeners();
  await evaluate(`document.querySelector('.burger').click()`);
  expectEq('повторное открытие', await until(`document.querySelector('#menu').open`), true);
  await evaluate(`document.querySelector('[data-close-menu]').click()`);
  await untilLong(`!document.querySelector('#menu').open && document.activeElement.classList.contains('burger') && document.querySelector('.burger').getAttribute('aria-expanded') === 'false'`);
  expectEq('закрытие кнопкой: шторка закрыта, фокус на «Меню»', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
  await evaluate(`document.querySelector('.burger').click()`);
  await until(`document.querySelector('#menu').open`);
  await evaluate(`document.querySelector('#menu').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await untilLong(`!document.querySelector('#menu').open && document.activeElement.classList.contains('burger') && document.querySelector('.burger').getAttribute('aria-expanded') === 'false'`);
  expectEq('клик по фону закрывает шторку', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
  const after = await listeners();
  expectEq('обработчики не добавляются при повторных открытиях', after, before);
  const counts = JSON.parse(after);
  for (const key of ['a.burger:click', 'a.burger:keydown', 'dialog#menu.modal:click', 'dialog#menu.modal:close', 'button.modal__close:click']) {
    if (counts[key] !== 1) fail(`${ctx}: обработчик ${key} зарегистрирован ${counts[key] ?? 0} раз (нужно 1)`);
  }
  // переход по пункту шторки
  await evaluate(`document.querySelector('.burger').click()`);
  await until(`document.querySelector('#menu').open`);
  await evaluate(`document.querySelector('#menu .menu-list a[href="${routes.contacts}"]').click()`);
  await settled();
  const afterNav = await evaluate(`({ path: location.pathname.replace(/\\/$/, ''), open: document.querySelector('#menu').open, h1: document.querySelector('h1').textContent.trim() })`);
  expectEq('переход из шторки на «Контакты»', [afterNav.path, afterNav.open, !!afterNav.h1], [routes.contacts, false, true]);
  // расширение окна при открытой шторке закрывает её
  await go('/about');
  await evaluate(`document.querySelector('.burger').click()`);
  await until(`document.querySelector('#menu').open`);
  await view(1440, 900);
  expectEq('рост окна до десктопа закрывает шторку', await until(`!document.querySelector('#menu').open`), true);
  report.push('mobile 390: шторка (открытие/закрытие, Esc, фокус, ловушка, фон), переходы; нижней панели нет');

  // --- 5. без JavaScript
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await view(390, 844);
  ctx = 'без JS @390';
  await go('/about');
  const nojs = await evaluate(`(() => ({ js: document.documentElement.dataset.js, burger: [document.querySelector('.burger').getAttribute('href'), document.querySelector('.burger').getAttribute('role')],
    solid: document.querySelector('.site-header').classList.contains('is-solid'), dock: !!document.querySelector('.dock'), menuOpen: document.querySelector('#menu').open }))()`);
  expectEq('без JS: «Меню» — якорь на навигацию подвала', nojs.burger, ['#site-nav', null]);
  expectEq('без JS: шапка светлая, нижней панели нет, шторка закрыта', [nojs.solid, nojs.dock, nojs.menuOpen], [true, false, false]);
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(900);
  const anchor = await evaluate(`(() => { const r = document.querySelector('#site-nav').getBoundingClientRect(); return { hash: location.hash, inView: r.top < innerHeight && r.bottom > 0, links: document.querySelectorAll('#site-nav a').length }; })()`);
  expectEq('без JS: якорь #site-nav ведёт к навигации подвала', [anchor.hash, anchor.inView, anchor.links], ['#site-nav', true, mainNav.length + 1]);
  await view(1440, 900);
  ctx = 'без JS @1440';
  await go('/about');
  const nojsDesk = await evaluate(`(() => ({ nav: [...document.querySelectorAll('.nav a')].filter((a) => a.getBoundingClientRect().width > 0).length, cta: document.querySelector('.site-header__actions .btn').getAttribute('href'),
    cur: document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') }))()`);
  expectEq('без JS: меню шапки, CTA, активный пункт', [nojsDesk.nav, nojsDesk.cta, nojsDesk.cur], [headernav.length, routes.contacts, '/about']);
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  report.push('без JS: меню шапки, якорь #site-nav, CTA ведёт в контакты, шапка читаема');

  // --- 5b. адреса главной (PROD-22): ссылка на раздел прокручивает к нему, адрес следует за прокруткой, ссылка на проект открывает окно на нужном снимке
  ctx = 'адреса главной';
  await view(1440, 900);
  // «Уменьшение движения»: прокрутка к разделу мгновенная, без анимации по кадрам — проверка не зависит от нагрузки на машину (плавность в headless не измерить).
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await go('/services');
  await untilLong(`document.documentElement.dataset.deeplink === 'ready'`);
  expectEq('/services: страница плавно прокручена к разделу услуг', await untilLong(`Math.abs(document.getElementById('home-services').getBoundingClientRect().top) < 260`), true);
  expectEq('/services: адрес сохранён', await evaluate('location.pathname'), '/services');
  await evaluate(`document.getElementById('home-projects').scrollIntoView()`);
  expectEq('адрес следует за прокруткой к «Проектам»', await untilLong(`location.pathname === '/projects'`), true);
  await evaluate('window.scrollTo(0, 0)');
  expectEq('наверху адрес снова главная', await untilLong(`location.pathname === '/'`), true);
  await go('/projects/nadezhda?photo=3');
  await untilLong(`document.documentElement.dataset.deeplink === 'ready'`);
  expectEq('/projects/nadezhda?photo=3: открыто окно проекта на третьем снимке', await untilLong(`document.querySelector('dialog[open]')?.id === 'project-modal-hope' && document.querySelector('dialog[open] [data-slides]').dataset.index === '2'`), true);
  expectEq('адрес окна с номером снимка', await evaluate(`location.pathname + location.search`), '/projects/nadezhda?photo=3');
  await evaluate(`document.querySelector('dialog[open] [data-slide-next]').click()`);
  expectEq('адрес следует за снимком', await untilLong(`location.search === '?photo=4'`), true);
  await evaluate(`document.querySelector('dialog[open] [data-modal-close]').click()`);
  expectEq('окно закрыто, адрес — раздел «Проекты»', await untilLong(`!document.querySelector('dialog[open]') && location.pathname === '/projects' && !location.search`), true);
  await go('/projects/all');
  expectEq('/projects/all: открыт список «Еще работы»', await untilLong(`document.querySelector('dialog[open]')?.id === 'list-modal-projects'`), true);
  await go('/services/all');
  expectEq('/services/all: открыт перечень услуг', await untilLong(`document.querySelector('dialog[open]')?.id === 'list-modal-services'`), true);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: '' }] });
  report.push('адреса главной: /services и окна открываются по ссылке, адрес следует за прокруткой и снимком');

  // --- 6. промежуточные ширины: 768 и 1024 — бургер и шторка работают, нижней панели нет
  for (const width of [768, 1024]) {
    ctx = `шторка @${width}`;
    await view(width, 900);
    await go('/about');
    const t = await evaluate(`(() => ({ burger: getComputedStyle(document.querySelector('.burger')).display, nav: getComputedStyle(document.querySelector('.nav')).display, dock: !!document.querySelector('.dock') }))()`);
    expectEq('меню на ширине', [t.burger !== 'none', t.nav !== 'none', t.dock], width <= 960 ? [true, false, false] : [false, true, false]);
    if (width <= 960) {
      await evaluate(`document.querySelector('.burger').click()`);
      expectEq('шторка открывается', await until(`document.querySelector('#menu').open`), true);
      await shot(`menu-open-${width}`);
      await press('Escape', 'Escape', 27);
      await sleep(200);
      await untilLong(`!document.querySelector('#menu').open && document.activeElement.classList.contains('burger') && document.querySelector('.burger').getAttribute('aria-expanded') === 'false'`);
      expectEq('Escape закрывает, фокус на «Меню»', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
    }
  }
} catch (error) {
  // сценарий оборвался: сообщаем, где именно, и печатаем всё, что уже найдено
  fail(`${ctx}: сценарий прерван: ${error.message.split('\n')[0]}`);
} finally {
  ws.close();
  browser.kill();
  server.close();
  await sleep(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

console.log(report.join('\n'));
if (errors.length) {
  console.error([...new Set(errors)].map((e) => `✗ ${e}`).join('\n'));
  console.error(`\ncheck-browser: ${new Set(errors).size} ошибок`);
  process.exit(1);
}
console.log(`check-browser: OK — ${WIDTHS.join(' / ')} px × ${PAGES.length} стр., консоль и сеть чистые, внешних запросов нет, меню, шторка, сценарии главной и режим без JS проверены`);

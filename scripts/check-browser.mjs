// Браузерная проверка собранного сайта (dist/) без Playwright: Edge/Chrome headless по CDP, встроенные http-сервер и WebSocket Node.
// Все страницы демо на ширинах 320 / 390 / 768 / 1024 / 1440: нет горизонтальной прокрутки и элементов за границей окна, нет ошибок консоли и сети,
// нет запросов вне локального сервера, загружены Manrope и Golos Text, логотипы отрисованы, у ссылок и кнопок есть имена, цели касания ≥ 44 px,
// одна оболочка (header, main, footer, skip-link), шапка не перекрывает заголовок, меню/бургер/CTA/нижняя панель показаны по ширине.
// Сценарии (DEMO-04): клавиатурный обход и skip-link; desktop — пункты шапки, aria-current, CTA, логотип, подвал; mobile — шторка меню
// (Esc, возврат фокуса, ловушка фокуса, фон, повторное открытие без дублей обработчиков), нижняя панель не перекрывает конец страницы;
// режим без JavaScript (якорь #site-nav, меню шапки); шторка на 768 и 1024.
// Использование: node scripts/check-browser.mjs [--shots <папка>] [--page /about] [--base http://localhost:4321]; браузер: переменная BROWSER_PATH или стандартные пути Windows.
// С --base проверяется уже запущенный сервер (например, dev), иначе поднимается свой сервер для dist/.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
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
const requestUrls = new Map();
let lastNavigation = 0;
listeners.push((msg) => {
  const { method, params } = msg;
  if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(params.type)) {
    fail(`${ctx}: console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (method === 'Runtime.exceptionThrown') {
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

const report = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (key, code, vk) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
};
// Опрос условия (до 2 с): медиа-запросы и события обновляются на следующем кадре, а не мгновенно.
const until = (expression) => evaluate(`new Promise((resolve) => { const t0 = Date.now(); const tick = () => { if (${expression}) resolve(true); else if (Date.now() - t0 > 2000) resolve(false); else setTimeout(tick, 50); }; tick(); })`);
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
  await evaluate('new Promise(r => document.readyState === "complete" ? r(true) : addEventListener("load", () => r(true)))');
  await evaluate('document.fonts.ready.then(() => true)');
};
const shot = async (name, clip) => {
  if (!shotsDir) return;
  await mkdir(shotsDir, { recursive: true });
  const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  await writeFile(join(shotsDir, `${name}.png`), Buffer.from(r.data, 'base64'));
};
const focusInfo = `(() => { const a = document.activeElement; const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
  return { tag: a.tagName.toLowerCase(), cls: a.className, id: a.id, text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40),
    outline: cs.outlineStyle + ' ' + cs.outlineWidth, visible: r.width > 0 && r.height > 0, inMenu: !!a.closest('#menu') }; })()`;
const expectEq = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${ctx}: ${what}: ${JSON.stringify(actual)} вместо ${JSON.stringify(expected)}`);
};

// Контракт оболочки: что должно быть на каждой странице. Подписи — из данных (src/data/ui.ts), пути — из src/data/nav.ts.
const { ui } = await import(pathToFileURL(join(root, 'src/data/ui.ts')).href);
const { mainNav, routes } = await import(pathToFileURL(join(root, 'src/data/nav.ts')).href);
const PAGES = pagePath ? [pagePath] : ['/', ...mainNav.map((i) => i.href), '/projects/tlt', routes.privacy, '/404.html'];

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
        const wide = [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          return r.width > 0 && cs.position !== 'fixed' && (r.right > W + 1 || r.left < -1);
        }).slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' [' + Math.round(el.getBoundingClientRect().left) + '…' + Math.round(el.getBoundingClientRect().right) + ']');
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
        const imgs = [...document.images].map((i) => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 }));
        const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
        const unnamed = [...document.querySelectorAll('a[href], button')].filter((el) => visible(el) && !(el.getAttribute('aria-label') || el.textContent.trim() || el.querySelector('img[alt]:not([alt=""])')))
          .map((el) => el.tagName.toLowerCase() + '.' + el.className);
        const small = [...document.querySelectorAll('.nav a, .burger, .btn, .dock a, .menu-list a, .footer__col a, .modal__close')].filter(visible)
          .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map((el) => el.className + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));
        const navLabels = [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label') || '');
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide, fonts, imgs, unnamed, small, navLabels,
          h1: document.querySelectorAll('h1').length, mains: document.querySelectorAll('main').length, headers: document.querySelectorAll('body > header').length,
          footers: document.querySelectorAll('body > footer').length, skip: document.querySelectorAll('a.skip').length,
          lang: de.lang, robots: document.querySelector('meta[name=robots]')?.content,
          burger: visible(document.querySelector('.burger')), nav: visible(document.querySelector('.nav')), dock: visible(document.querySelector('.dock')),
          cta: visible(document.querySelector('.site-header__actions .btn')), phone: visible(document.querySelector('.header-phone')),
          h1Top: document.querySelector('h1').getBoundingClientRect().top, headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom };
      })()`);
      if (m.scrollW > m.clientW) fail(`${ctx}: горизонтальная прокрутка (scrollWidth ${m.scrollW} > ${m.clientW})`);
      if (m.wide.length) fail(`${ctx}: элементы за границей окна: ${m.wide.join(', ')}`);
      for (const fam of ['Manrope', 'Golos Text']) if (!m.fonts.includes(fam)) fail(`${ctx}: шрифт ${fam} не загружен (загружены: ${m.fonts.join(', ') || 'нет'})`);
      for (const i of m.imgs) if (!i.ok) fail(`${ctx}: изображение не отрисовано: ${i.src}`);
      if (m.unnamed.length) fail(`${ctx}: ссылки/кнопки без доступного имени: ${m.unnamed.join(', ')}`);
      if (m.small.length) fail(`${ctx}: цель касания меньше 44 px: ${m.small.join('; ')}`);
      expectEq('h1', m.h1, 1);
      expectEq('main', m.mains, 1);
      expectEq('header/footer', [m.headers, m.footers, m.skip], [1, 1, 1]);
      expectEq('lang', m.lang, 'ru');
      expectEq('robots', m.robots, 'noindex, nofollow');
      if (new Set(m.navLabels).size !== m.navLabels.length || m.navLabels.some((l) => !l)) fail(`${ctx}: у <nav> нет уникальных подписей: ${JSON.stringify(m.navLabels)}`);
      if (m.h1Top < m.headerBottom - 0.5) fail(`${ctx}: шапка перекрывает заголовок (h1 ${Math.round(m.h1Top)} < шапка ${Math.round(m.headerBottom)})`);
      // видимость элементов оболочки по ширине: десктоп ≥ 961 — меню в шапке, мобильное — бургер; нижняя панель ≤ 640
      expectEq('меню в шапке / бургер', [m.nav, m.burger], width > 960 ? [true, false] : [false, true]);
      expectEq('CTA «Заказать звонок» в шапке', m.cta, width > 960);
      expectEq('телефон в шапке', m.phone, width > 1180);
      expectEq('нижняя панель', m.dock, width <= 640);
      if (path === '/') report.push(`${width}px: scrollWidth ${m.scrollW}/${m.clientW}, шрифты: ${[...new Set(m.fonts)].join(' + ')}, изображений ${m.imgs.length}, запросов ${requests.size}`);
    }
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
      const wanted = [...mainNav.map((i) => i.label), ui.actions.orderCall];
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
  await go('/services');
  const desk = await evaluate(`(() => ({
    nav: [...document.querySelectorAll('.nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]),
    cta: [document.querySelector('.site-header__actions .btn').textContent.trim(), document.querySelector('.site-header__actions .btn').getAttribute('href')],
    phone: document.querySelector('.header-phone').getAttribute('href'), logo: document.querySelector('.site-header .logo').getAttribute('href'),
    solid: document.querySelector('.site-header').classList.contains('is-solid'),
    logoShown: [...document.querySelectorAll('.site-header .logo__img')].filter((i) => getComputedStyle(i).display !== 'none').map((i) => i.src.split('/').pop().split('.')[0]),
    footer: [...document.querySelectorAll('#site-nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]),
    vacancy: (() => { const el = [...document.querySelectorAll('#site-nav li > .off')][0]; return { text: el.textContent.trim().replace(/\\s+/g, ' '), focusable: el.matches('a,button,[tabindex]'), tag: el.tagName.toLowerCase() }; })(),
    privacy: document.querySelector('.footer__bottom a').getAttribute('href'),
  }))()`);
  expectEq('пункты шапки', desk.nav.map((n) => n[0]), mainNav.map((i) => i.label));
  expectEq('ссылки шапки', desk.nav.map((n) => n[1]), mainNav.map((i) => i.href));
  expectEq('aria-current в шапке на /services', desk.nav.map((n) => n[2]), [ 'page', null, null, null ]);
  expectEq('CTA шапки', desk.cta, [ui.actions.orderCall, routes.contacts]);
  expectEq('ссылка логотипа', desk.logo, routes.home);
  expectEq('логотип над светлой шапкой', desk.logoShown, ['logo-wordmark']);
  expectEq('телефон — tel:', desk.phone.startsWith('tel:+7'), true);
  expectEq('разделы подвала', desk.footer.map((f) => f[1]), mainNav.map((i) => i.href));
  expectEq('«Вакансии» не ссылка', [desk.vacancy.focusable, desk.vacancy.tag, desk.vacancy.text.startsWith(ui.nav.vacancies), desk.vacancy.text.includes(ui.placeholders.feature)], [false, 'span', true, true]);
  expectEq('политика в подвале', desk.privacy, routes.privacy);
  await shot('header-desktop', { x: 0, y: 0, width: 1440, height: 200 });

  // переходы: каждый пункт шапки открывает страницу, на ней он активен, затем логотип возвращает на главную
  for (const item of mainNav) {
    await go('/');
    await evaluate(`document.querySelector('.nav a[href="${item.href}"]').click()`);
    await settled();
    const r = await evaluate(`({ path: location.pathname.replace(/\\/$/, ''), h1: document.querySelector('h1').textContent.trim(), cur: document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') })`);
    expectEq(`переход «${item.label}»`, [r.path, r.cur, r.h1], [item.href, item.href, item.label]);
  }
  await evaluate(`document.querySelector('.site-header .logo').click()`);
  await settled();
  expectEq('логотип ведёт на главную', await evaluate('location.pathname'), '/');
  await go('/');
  await evaluate(`document.querySelector('.site-header__actions .btn').click()`);
  await settled();
  expectEq('CTA «Заказать звонок» ведёт в контакты', await evaluate(`location.pathname.replace(/\\/$/, '')`), routes.contacts);
  await go('/projects/tlt');
  expectEq('/projects/tlt: «Проекты» отмечены aria-current=true', await evaluate(`document.querySelector('.nav a[href="/projects"]').getAttribute('aria-current')`), 'true');
  await go('/privacy');
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(300);
  await shot('footer-desktop');
  report.push('desktop 1440: пункты шапки, активный пункт, CTA, логотип, подвал, «Вакансии» — не ссылка');

  // --- 4. mobile 390: шторка меню, нижняя панель
  await view(390, 844);
  ctx = 'mobile 390';
  await go('/about');
  await shot('header-mobile', { x: 0, y: 0, width: 390, height: 180 });
  await shot('menu-closed-mobile');
  const dockInfo = await evaluate(`(() => { const d = document.querySelector('.dock'); const r = d.getBoundingClientRect(); const cs = getComputedStyle(d);
    return { pos: cs.position, bottomGap: Math.round(innerHeight - r.bottom), links: [...d.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), Math.round(a.getBoundingClientRect().height)]), pad: cs.paddingBottom }; })()`);
  expectEq('нижняя панель: закреплена у нижнего края', [dockInfo.pos, dockInfo.bottomGap], ['fixed', 0]);
  expectEq('нижняя панель: кнопки', dockInfo.links.map((l) => [l[0], l[1].startsWith('tel:+7') ? 'tel' : l[1]]), [[ui.actions.call, 'tel'], [ui.actions.leaveRequest, routes.contacts]]);
  if (dockInfo.links.some((l) => l[2] < 44)) fail(`${ctx}: кнопка нижней панели ниже 44 px: ${JSON.stringify(dockInfo.links)}`);
  await evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await sleep(300);
  const overlap = await evaluate(`(() => { const dock = document.querySelector('.dock').getBoundingClientRect(); const last = document.querySelector('.footer__bottom').getBoundingClientRect();
    return { dockTop: Math.round(dock.top), contentBottom: Math.round(last.bottom), atEnd: Math.round(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1 }; })()`);
  if (!overlap.atEnd || overlap.contentBottom > overlap.dockTop) fail(`${ctx}: нижняя панель перекрывает конец страницы (контент до ${overlap.contentBottom}, панель с ${overlap.dockTop})`);
  await shot('bottom-bar-mobile');
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
  expectEq('шторка: фон не прокручивается', open.overflow, 'hidden');
  if (open.hScroll) fail(`${ctx}: горизонтальная прокрутка при открытом меню`);
  expectEq('шторка: пункты', open.items.map((i) => [i[0], i[1]]), mainNav.map((i) => [i.label, i.href]));
  expectEq('шторка: активный раздел «О компании»', open.items.map((i) => i[2]), [null, null, 'page', null]);
  expectEq('шторка: кнопка заявки', open.cta, [ui.actions.orderCall, routes.contacts]);
  await shot('menu-open-mobile');
  // ловушка фокуса: 14 нажатий Tab и 3 Shift+Tab, фокус всё время в шторке
  let leaked = false;
  for (let i = 0; i < 14; i++) { await press('Tab', 'Tab', 9); const f = await evaluate(focusInfo); if (!f.inMenu && f.tag !== 'body') leaked = true; }
  if (leaked) fail(`${ctx}: фокус вышел за пределы шторки при Tab`);
  await press('Escape', 'Escape', 27);
  await sleep(250);
  const closed = await evaluate(`({ open: document.querySelector('#menu').open, active: document.activeElement.className.split(' ')[0], expanded: document.querySelector('.burger').getAttribute('aria-expanded'), overflow: getComputedStyle(document.documentElement).overflow })`);
  expectEq('Escape закрывает шторку, фокус возвращается на «Меню»', [closed.open, closed.active, closed.expanded, closed.overflow], [false, 'burger', 'false', 'visible']);
  // повторное открытие: кнопкой закрытия, потом кликом по фону. Обработчики регистрируются один раз и не множатся при открытиях
  const listeners = () => evaluate('JSON.stringify(window.__listeners)');
  const before = await listeners();
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(150);
  expectEq('повторное открытие', await evaluate(`document.querySelector('#menu').open`), true);
  await evaluate(`document.querySelector('[data-close-menu]').click()`);
  await sleep(150);
  expectEq('закрытие кнопкой: шторка закрыта, фокус на «Меню»', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(150);
  await evaluate(`document.querySelector('#menu').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(150);
  expectEq('клик по фону закрывает шторку', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
  const after = await listeners();
  expectEq('обработчики не добавляются при повторных открытиях', after, before);
  const counts = JSON.parse(after);
  for (const key of ['a.burger:click', 'a.burger:keydown', 'dialog#menu.modal:click', 'dialog#menu.modal:close', 'button.modal__close:click']) {
    if (counts[key] !== 1) fail(`${ctx}: обработчик ${key} зарегистрирован ${counts[key] ?? 0} раз (нужно 1)`);
  }
  // переход по пункту шторки
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(150);
  await evaluate(`document.querySelector('#menu .menu-list a[href="${routes.contacts}"]').click()`);
  await settled();
  const afterNav = await evaluate(`({ path: location.pathname.replace(/\\/$/, ''), open: document.querySelector('#menu').open, h1: document.querySelector('h1').textContent.trim() })`);
  expectEq('переход из шторки на «Контакты»', [afterNav.path, afterNav.open, afterNav.h1], [routes.contacts, false, ui.nav.contacts]);
  // нижняя панель: переход «Оставить заявку» → /contacts
  await go('/services');
  await evaluate(`document.querySelector('.dock a[href="${routes.contacts}"]').click()`);
  await settled();
  expectEq('«Оставить заявку» ведёт в контакты', await evaluate(`location.pathname.replace(/\\/$/, '')`), routes.contacts);
  // расширение окна при открытой шторке закрывает её
  await go('/about');
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(150);
  await view(1440, 900);
  expectEq('рост окна до десктопа закрывает шторку', await until(`!document.querySelector('#menu').open`), true);
  report.push('mobile 390: шторка (открытие/закрытие, Esc, фокус, ловушка, фон), нижняя панель, переходы');

  // --- 5. без JavaScript
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await view(390, 844);
  ctx = 'без JS @390';
  await go('/services');
  const nojs = await evaluate(`(() => ({ js: document.documentElement.dataset.js, burger: [document.querySelector('.burger').getAttribute('href'), document.querySelector('.burger').getAttribute('role')],
    solid: document.querySelector('.site-header').classList.contains('is-solid'), dock: getComputedStyle(document.querySelector('.dock')).display, menuOpen: document.querySelector('#menu').open }))()`);
  expectEq('без JS: «Меню» — якорь на навигацию подвала', nojs.burger, ['#site-nav', null]);
  expectEq('без JS: шапка светлая, нижняя панель на месте, шторка закрыта', [nojs.solid, nojs.dock, nojs.menuOpen], [true, 'grid', false]);
  await evaluate(`document.querySelector('.burger').click()`);
  await sleep(900);
  const anchor = await evaluate(`(() => { const r = document.querySelector('#site-nav').getBoundingClientRect(); return { hash: location.hash, inView: r.top < innerHeight && r.bottom > 0, links: document.querySelectorAll('#site-nav a').length }; })()`);
  expectEq('без JS: якорь #site-nav ведёт к навигации подвала', [anchor.hash, anchor.inView, anchor.links], ['#site-nav', true, mainNav.length]);
  await view(1440, 900);
  ctx = 'без JS @1440';
  await go('/services');
  const nojsDesk = await evaluate(`(() => ({ nav: [...document.querySelectorAll('.nav a')].filter((a) => a.getBoundingClientRect().width > 0).length, cta: document.querySelector('.site-header__actions .btn').getAttribute('href'),
    cur: document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') }))()`);
  expectEq('без JS: меню шапки, CTA, активный пункт', [nojsDesk.nav, nojsDesk.cta, nojsDesk.cur], [mainNav.length, routes.contacts, '/services']);
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  report.push('без JS: меню шапки, якорь #site-nav, CTA ведёт в контакты, шапка читаема');

  // --- 6. промежуточные ширины: 768 и 1024 — бургер и шторка работают, нижней панели нет
  for (const width of [768, 1024]) {
    ctx = `шторка @${width}`;
    await view(width, 900);
    await go('/projects');
    const t = await evaluate(`(() => ({ burger: getComputedStyle(document.querySelector('.burger')).display, nav: getComputedStyle(document.querySelector('.nav')).display, dock: getComputedStyle(document.querySelector('.dock')).display }))()`);
    expectEq('меню на ширине', [t.burger !== 'none', t.nav !== 'none', t.dock !== 'none'], width <= 960 ? [true, false, false] : [false, true, false]);
    if (width <= 960) {
      await evaluate(`document.querySelector('.burger').click()`);
      await sleep(200);
      expectEq('шторка открывается', await evaluate(`document.querySelector('#menu').open`), true);
      await shot(`menu-open-${width}`);
      await press('Escape', 'Escape', 27);
      await sleep(200);
      await until(`!document.querySelector('#menu').open && document.activeElement.classList.contains('burger')`);
      expectEq('Escape закрывает, фокус на «Меню»', await evaluate(`[document.querySelector('#menu').open, document.activeElement.className.split(' ')[0]]`), [false, 'burger']);
    }
  }
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
console.log(`check-browser: OK — ${WIDTHS.join(' / ')} px × ${PAGES.length} стр., консоль и сеть чистые, внешних запросов нет, меню, нижняя панель и режим без JS проверены`);

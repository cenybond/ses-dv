// Проверка ссылок собранного сайта (DEMO-04). Запуск: npm run check-links [-- --dist <папка>] (после npm run build).
// Только <a href> в dist/ (ресурсы и внешние запросы проверяет check-dist). Безусловных исключений нет: страница, которой нет в dist, — ошибка.
//  1. локальные ссылки ведут на существующие страницы dist/ (каталог/index.html или файл.html);
//  2. фрагменты (#id, /страница#id) указывают на существующие id в целевой странице;
//  3. нет пустых href, href="#", javascript:;
//  4. нет ссылок на старый сайт (ses-dv.ru, Tilda, /pageNNN.html, адреса снимков docs/content/source/);
//  5. нет ссылок на исключённые разделы («Благодарности», «Оснащение»: снимки с classification: EXCLUDE и тексты ссылок);
//  6. внутренние пути абсолютные и чистые: без //, \, .., .html, /index, пробелов, query;
//  7. внешние только tel:+7XXXXXXXXXX, mailto:адрес (без префикса «e-mail:»), https://wa.me/7XXXXXXXXXX и вакансии на hh.ru (nav.ts, с target=_blank rel=noopener);
//  8. target="_blank" только с rel="noopener";
//  9. aria-current: у ссылок навигации на текущую страницу — «page», на страницы раздела — «true», нигде больше; в основной навигации
//     страницы-пункта ровно один «page», на странице внутри раздела — ровно один «true», на остальных страницах (главная, политика, 404) — ни одного.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const distArg = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : undefined;
const dist = distArg ? resolve(distArg) : join(repo, 'dist');
if (!existsSync(dist)) {
  console.error(`${dist} не найден: сначала npm run build`);
  process.exit(1);
}
const { mainNav, normalizePath, vacanciesExternalUrl: HH_VACANCIES } = await import(pathToFileURL(join(repo, 'src/data/nav.ts')).href);
const { ui } = await import(pathToFileURL(join(repo, 'src/data/ui.ts')).href);

const errors = [];
const fail = (page, msg) => errors.push(`${page}: ${msg}`);
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// --- адреса действующего (старого) сайта и исключённые разделы — из снимков
const sourceDir = join(repo, 'docs/content/source');
const oldPaths = new Set();
const excludedPaths = new Set(['/gratitude', '/mtb']); // «Благодарности», «Оснащение» (CLAUDE.md); дополняется снимками с EXCLUDE
if (existsSync(sourceDir)) {
  for (const f of readdirSync(sourceDir).filter((n) => n.endsWith('.md'))) {
    const head = readFileSync(join(sourceDir, f), 'utf8').split(/^---$/m)[1] ?? '';
    const url = head.match(/^source_url:\s*(\S+)/m)?.[1];
    if (!url) continue;
    const path = '/' + url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/$/, '');
    oldPaths.add(path === '/' ? '/' : path);
    if (/^classification:\s*EXCLUDE/m.test(head)) excludedPaths.add(path);
  }
}
const EXCLUDED_TEXT = /Благодарност|Оснащени/i;

// --- страницы dist/
const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
/** Путь страницы по файлу: index.html → '/', x/index.html → '/x', 404.html → null (не маршрут). */
const pagePathOf = (file) => {
  const rel = relative(dist, file).replaceAll('\\', '/');
  if (rel === '404.html') return null;
  return normalizePath('/' + rel.replace(/(?:^|\/)index\.html$/, '').replace(/\.html$/, ''));
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const parseAttrs = (src) => {
  const attrs = {};
  for (const m of src.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
};
const idsOf = (html) => new Set([...html.matchAll(/\sid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));

const pages = new Map(); // путь маршрута → { file, html, ids }
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const path = pagePathOf(file);
  const key = path ?? '/404.html';
  pages.set(key, { file, html, ids: idsOf(html), path });
}
const routeExists = (path) => pages.has(normalizePath(path)) && pages.get(normalizePath(path)).path !== null;

const stats = { pages: pages.size, links: 0, internal: 0, contact: 0, fragments: 0 };

for (const [key, page] of pages) {
  const label = relative(repo, page.file).replaceAll('\\', '/');
  const where = label.startsWith('..') ? relative(dist, page.file).replaceAll('\\', '/') : label;
  const html = page.html;

  // <nav> с их ссылками: для проверки aria-current
  const navs = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)].map((m) => ({ attrs: parseAttrs(m[1]), start: m.index, end: m.index + m[0].length }));
  // подвал целиком тоже область навигации: ссылка на политику лежит вне <nav>
  const footers = [...html.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  const inNav = (index) => [...navs, ...footers].find((n) => index >= n.start && index < n.end);

  const links = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = parseAttrs(m[1]);
    links.push({ attrs, text: decode(m[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim(), index: m.index });
  }

  for (const { attrs, text, index } of links) {
    if (!('href' in attrs)) continue; // <a> без href — не ссылка (inert), SPEC-DEMO §7
    stats.links++;
    const href = attrs.href;
    const name = `«${href}» («${text.slice(0, 30)}»)`;

    if (!href.trim()) { fail(where, `пустой href у ссылки «${text.slice(0, 30)}»`); continue; }
    if (href === '#') { fail(where, `href="#" у ссылки «${text.slice(0, 30)}»`); continue; }
    if (/^\s*javascript:/i.test(href)) { fail(where, `javascript: в ссылке ${name}`); continue; }
    if (EXCLUDED_TEXT.test(text)) fail(where, `ссылка на исключённый раздел по тексту: ${name}`);
    if (attrs.target === '_blank' && !/\bnoopener\b/.test(attrs.rel ?? '')) fail(where, `target="_blank" без rel="noopener": ${name}`);

    // контакты и внешние
    if (/^tel:/i.test(href)) {
      stats.contact++;
      if (!/^tel:\+7\d{10}$/.test(href)) fail(where, `некорректный tel: ${name} (нужно tel:+7 и 10 цифр без пробелов)`);
      continue;
    }
    if (/^mailto:/i.test(href)) {
      stats.contact++;
      if (!/^mailto:[^\s@?:]+@[^\s@?:]+\.[A-Za-z]{2,}$/.test(href)) fail(where, `некорректный mailto: ${name}`);
      continue;
    }
    if (/^https:\/\/wa\.me\//.test(href)) {
      stats.contact++;
      if (!/^https:\/\/wa\.me\/7\d{10}$/.test(href)) fail(where, `некорректная ссылка WhatsApp ${name} (нужно https://wa.me/7 и 10 цифр, без текста)`);
      continue;
    }
    if (href.replaceAll('&amp;', '&') === HH_VACANCIES) {
      stats.contact++;
      if (attrs.target !== '_blank' || !/\bnoopener\b/.test(attrs.rel ?? '')) fail(where, `ссылка на hh.ru должна открываться с target="_blank" rel="noopener noreferrer": ${name}`);
      continue;
    }
    // Адрес в блоке контактов на главной (PROD-23): ссылка на точку в 2ГИС, новая вкладка.
    if (href === 'https://2gis.ru/blagoveshchensk?m=127.486127%2C50.281787%2F17') {
      stats.contact++;
      if (attrs.target !== '_blank' || !/\bnoopener\b/.test(attrs.rel ?? '')) fail(where, `ссылка в 2ГИС должна открываться с target="_blank" rel="noopener noreferrer": ${name}`);
      continue;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      if (/tilda|ses-dv\.ru/i.test(href)) fail(where, `ссылка на старый сайт ${name}`);
      else fail(where, `недопустимая внешняя ссылка ${name} (разрешены tel:, mailto:, https://wa.me/)`);
      continue;
    }

    // фрагмент в пределах страницы
    if (href.startsWith('#')) {
      stats.fragments++;
      if (!page.ids.has(href.slice(1))) fail(where, `якорь ${name}: на странице нет id="${href.slice(1)}"`);
      continue;
    }

    // внутренние пути
    stats.internal++;
    const [pathAndQuery, fragment] = [href.split('#')[0], href.includes('#') ? href.slice(href.indexOf('#') + 1) : undefined];
    if (!pathAndQuery.startsWith('/')) { fail(where, `относительный внутренний путь ${name}: нужен абсолютный, от корня`); continue; }
    const path = pathAndQuery;
    const bad = [
      [/\/\//, 'двойной слэш'], [/\\/, 'обратный слэш'], [/(?:^|\/)\.\.?(?:\/|$)/, 'сегмент . или ..'], [/\.html?$/i, 'расширение .html'],
      [/\/index$/, '/index в конце'], [/\s|%20/, 'пробел'], [/\?/, 'query-строка'], [/^\/(?:dist|src|public|node_modules)(?:\/|$)/, 'путь служебной папки'],
    ].find(([re]) => re.test(path));
    if (bad) { fail(where, `некорректный внутренний путь ${name}: ${bad[1]}`); continue; }

    const normal = normalizePath(path);
    if (excludedPaths.has(normal)) { fail(where, `ссылка на исключённый раздел ${name}`); continue; }
    if (/^\/page\d+(?:\.html)?$/.test(normal)) { fail(where, `ссылка на старый URL Tilda ${name}`); continue; }
    if (!routeExists(normal)) {
      fail(where, oldPaths.has(normal) && normal !== '/' ? `ссылка на старый URL действующего сайта ${name}, страницы в демо нет` : `ссылка на несуществующую страницу ${name}`);
      continue;
    }
    if (fragment !== undefined) {
      stats.fragments++;
      if (!fragment) fail(where, `пустой фрагмент ${name}`);
      else if (!pages.get(normal).ids.has(fragment)) fail(where, `якорь ${name}: на странице ${normal} нет id="${fragment}"`);
    }
  }

  // --- aria-current
  const current = links.filter((l) => 'aria-current' in l.attrs);
  const mainNavLinks = (() => {
    const nav = navs.find((n) => n.attrs['aria-label'] === ui.a11y.mainNav);
    return nav ? links.filter((l) => l.index > nav.start && l.index < nav.end) : null;
  })();
  // 404 — отдельная страница без шапки (решение владельца 2026-11-18): навигации на ней нет и быть не должно.
  if (!mainNavLinks && page.path !== null) fail(where, `нет навигации «${ui.a11y.mainNav}»`);
  const path = page.path;
  for (const l of current) {
    const v = l.attrs['aria-current'];
    const target = l.attrs.href?.startsWith('/') && !l.attrs.href.includes('#') ? normalizePath(l.attrs.href) : null;
    if (!['page', 'true'].includes(v)) { fail(where, `aria-current="${v}" у «${l.attrs.href}»: допустимы page и true`); continue; }
    if (path === null || target === null) { fail(where, `aria-current="${v}" у «${l.attrs.href}» на странице, которая не пункт навигации`); continue; }
    const expected = target === path ? 'page' : target !== '/' && path.startsWith(`${target}/`) ? 'true' : null;
    if (expected !== v) fail(where, `aria-current="${v}" у «${l.attrs.href}» на странице ${path} (ожидается ${expected ?? 'отсутствие атрибута'})`);
  }
  if (path !== null) {
    for (const l of links) {
      // логотип ведёт на главную с любой страницы и не пункт навигации
      if ((l.attrs.class ?? '').split(' ').includes('logo')) continue;
      if (!inNav(l.index) || !l.attrs.href?.startsWith('/') || l.attrs.href.includes('#')) continue;
      const target = normalizePath(l.attrs.href);
      const expected = target === path ? 'page' : target !== '/' && path.startsWith(`${target}/`) ? 'true' : undefined;
      if (expected && l.attrs['aria-current'] !== expected) fail(where, `у ссылки навигации «${l.attrs.href}» («${l.text}») нет aria-current="${expected}" на странице ${path}`);
    }
  }
  if (mainNavLinks) {
    const pageCount = mainNavLinks.filter((l) => l.attrs['aria-current'] === 'page').length;
    const sectionCount = mainNavLinks.filter((l) => l.attrs['aria-current'] === 'true').length;
    const isItem = path !== null && (path === '/' || mainNav.some((i) => i.href === path));
    const inSection = path !== null && !isItem && mainNav.some((i) => path.startsWith(`${i.href}/`));
    const [wantPage, wantSection] = isItem ? [1, 0] : inSection ? [0, 1] : [0, 0];
    if (pageCount !== wantPage) fail(where, `в основной навигации aria-current="page": ${pageCount}, ожидается ${wantPage}`);
    if (sectionCount !== wantSection) fail(where, `в основной навигации aria-current="true": ${sectionCount}, ожидается ${wantSection}`);
  }
  void key;
}

if (errors.length) {
  console.error([...new Set(errors)].map((e) => `✗ ${e}`).join('\n'));
  console.error(`\ncheck-links: ${new Set(errors).size} ошибок`);
  process.exit(1);
}
console.log(
  `check-links: OK — ${stats.pages} стр., ссылок ${stats.links} (внутренних ${stats.internal}, tel/mailto/WhatsApp ${stats.contact}, якорей ${stats.fragments}), ` +
    `старых/исключённых/пустых/«#»/внешних лишних нет, aria-current корректен`,
);

// Проверка собранного сайта (dist/): структура страниц, пути к ресурсам, отсутствие внешних запросов.
// Для каждого HTML: lang="ru", noindex в демо, один <h1>, у <img> есть alt, id уникальны, якоря #… существуют.
// Для ссылок и ресурсов: внешние допустимы только tel:, mailto:, https://wa.me/; локальные файлы существуют.
// Внутренние ссылки на страницы, ещё не созданные своей фазой (src/data/nav.ts, built:false), не ошибка, а список ожидающих.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ не найден: сначала npm run build');
  process.exit(1);
}
const { mainNav, pendingRoutes } = await import(pathToFileURL(join(root, 'src/data/nav.ts')).href);
void mainNav;

const errors = [];
const pending = new Set();
const fail = (msg) => errors.push(msg);
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const all = walk(dist);
const htmlFiles = all.filter((f) => f.endsWith('.html'));
if (all.some(file => /(?:\.map|\.env|package\.json)$/.test(file))) fail('служебный файл или source map попал в dist');
const demo = process.env.PUBLIC_SITE_MODE !== 'production' || process.env.PUBLIC_LEGAL_APPROVED !== 'true';
// Единственная внешняя ссылка кроме tel:, mailto:, wa.me — вакансии на hh.ru (решение владельца 2026-11-18); в HTML & записан как &amp;.
const HH_VACANCIES = 'https://blagoveschensk.hh.ru/employer/9992331?hhtmFrom=vacancy&tab=VACANCIES';
const isExternalOk = (u) => u.startsWith('tel:') || u.startsWith('mailto:') || u.startsWith('https://wa.me/') || u.replaceAll('&amp;', '&') === HH_VACANCIES
  || /^https:\/\/yandex\.ru\/map-widget\/v1\/\?ll=(?:127\.485097|127\.486127),50\.282061&z=17&pt=127\.486127,50\.281787,pm2gnm$/.test(u.replaceAll('&amp;', '&'))
  || u === 'https://yandex.ru/legal/confidential/'
  || u === 'https://2gis.ru/blagoveshchensk?m=127.486127%2C50.281787%2F17'; // адрес в блоке контактов (PROD-23): ссылка в 2ГИС
  // карта контактов на главной (PROD-23): iframe — условие выше, перед ним

/** Путь URL ('/a/b') → файл в dist или null. */
function resolveLocal(urlPath) {
  const clean = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  const candidates = [clean, posix.join(clean, 'index.html'), `${clean}.html`].map((c) => join(dist, c));
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function checkRef(from, ref) {
  if (!ref || ref.startsWith('data:')) return;
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) {
    if (!isExternalOk(ref)) fail(`${from}: внешняя ссылка/ресурс «${ref}»`);
    return;
  }
  if (ref.startsWith('#')) return; // якоря проверяются отдельно
  const urlPath = ref.startsWith('/') ? ref : posix.join('/', posix.dirname('/' + relative(dist, from).replaceAll('\\', '/')), ref);
  if (!resolveLocal(urlPath)) {
    const route = urlPath.split('#')[0].replace(/\/$/, '') || '/';
    if (pendingRoutes.includes(route)) pending.add(route);
    else fail(`${relative(root, from)}: ссылка «${ref}» ведёт на несуществующий файл`);
  }
}

for (const file of htmlFiles) {
  const rel = relative(root, file);
  const html = readFileSync(file, 'utf8');
  if (!/<html[^>]*\blang="ru"/.test(html)) fail(`${rel}: нет lang="ru"`);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (demo && !noindex) fail(`${rel}: нет noindex в демо-сборке`);
  if (!demo && noindex && !/(?:404|consent|cookies)/.test(rel)) fail(`${rel}: noindex в production-сборке`);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(`${rel}: <h1> ${h1} шт. (нужен один)`);
  for (const img of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt(?=[\s=>])/.test(img[0])) fail(`${rel}: <img> без alt`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fail(`${rel}: повторяющиеся id: ${[...new Set(dup)].join(', ')}`);
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) if (!ids.includes(m[1])) fail(`${rel}: якорь #${m[1]} не найден`);

  const withoutCanonical = html.replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '');
  for (const m of withoutCanonical.matchAll(/\s(?:href|src)="([^"]*)"/g)) checkRef(file, m[1]);
  if (/<script[^>]+src="https?:/.test(html)) fail(`${rel}: внешний скрипт`);
  for (const form of html.matchAll(/<form\b[^>]*>/g)) {
    if (!/action="\/api\/leads"/.test(form[0]) || !/method="post"/.test(form[0]) || !/data-lead-form/.test(form[0])) fail(`${rel}: неподтверждённый адрес или метод формы`);
  }
  // Единственный разрешённый iframe — карта в блоке контактов на главной (PROD-23): адрес из isExternalOk, заголовок для скринридеров, referrerpolicy=no-referrer.
  for (const frame of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const src = /\ssrc="([^"]*)"/.exec(frame[0])?.[1] ?? '';
    if (!isExternalOk(src) || !src.startsWith('https://yandex.ru/') || !/\stitle="[^"]+"/.test(frame[0]) || !/referrerpolicy="no-referrer"/.test(frame[0])) fail(`${rel}: iframe не согласован (разрешена только карта контактов): ${frame[0].slice(0, 120)}`);
  }
}

// CSS: url() и шрифты
const cssFiles = all.filter((f) => f.endsWith('.css'));
const fonts = new Set();
for (const css of cssFiles) {
  const text = readFileSync(css, 'utf8');
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    if (m[1].startsWith('data:')) continue;
    checkRef(css, m[1]);
    if (/\.woff2$/.test(m[1])) fonts.add(m[1]);
  }
}
const woff2 = all.filter((f) => f.endsWith('.woff2'));
for (const family of ['manrope-cyrillic', 'manrope-latin', 'golos-text-cyrillic', 'golos-text-latin']) {
  if (!woff2.some((f) => f.includes(family))) fail(`в dist нет WOFF2 ${family}`);
}
if (all.some((f) => /\.(?:woff|ttf|otf)$/.test(f))) fail('в dist есть шрифты не WOFF2');

// SVG логотипов: без скриптов и внешних ссылок и побайтно равны исходникам design/system/logo/ (геометрия не менялась)
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const logoDir = join(root, 'design/system/logo');
const sources = new Map(readdirSync(logoDir).map((n) => [sha(readFileSync(join(logoDir, n))), n]));
const svgs = all.filter((f) => f.endsWith('.svg'));
for (const svg of svgs) {
  const buf = readFileSync(svg);
  if (/<script|<style|<image|href=|url\(|<foreignObject/i.test(buf.toString('utf8'))) fail(`${relative(root, svg)}: небезопасное содержимое SVG`);
  if (!sources.has(sha(buf))) fail(`${relative(root, svg)}: не совпадает ни с одним файлом design/system/logo/`);
}
const usedLogos = new Set(svgs.map((f) => sources.get(sha(readFileSync(f)))));
// logo-full-on-dark.svg в подвале больше не используется: его место занял крупный декоративный знак (SiteFooter.astro).
for (const name of ['logo-wordmark.svg', 'logo-wordmark-on-dark.svg', 'logo-mark-square.svg']) {
  if (!usedLogos.has(name)) fail(`в dist нет логотипа ${name}`);
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\ncheck-dist: ${errors.length} ошибок`);
  process.exit(1);
}

const gz = (files) => files.reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0);
const js = all.filter((f) => f.endsWith('.js'));
console.log(
  `check-dist: OK — ${htmlFiles.length} стр., WOFF2: ${woff2.length}, SVG-логотипов: ${svgs.length}, CSS: ${cssFiles.length} (${(gz(cssFiles) / 1024).toFixed(1)} КБ gz), ` +
    `JS: ${js.length} (${(gz(js) / 1024).toFixed(1)} КБ gz), noindex: ${demo ? 'да' : 'нет'}`,
);
if (pending.size) console.log(`ожидают своих фаз (ссылки в интерфейсе ведут на несозданные страницы): ${[...pending].sort().join(', ')}`);

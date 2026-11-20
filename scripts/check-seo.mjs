// Проверка артефакта сборки и полного соответствия реестру миграции.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirects } from '../src/data/redirects.ts';
import { published_routes } from '../src/data/publications.ts';
import { legal_content_approved } from '../src/data/site-config.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const rows = readFileSync(join(root, 'docs/URL-MIGRATION.md'), 'utf8').split(/\r?\n/).filter((line) => /^\| \d+ \| `/.test(line));
const oldpaths = rows.map((line) => line.split('|')[2].trim().replaceAll('`', ''));
assert.equal(redirects.length, 50);
assert.equal(new Set(redirects.map((row) => row.from)).size, 50);
assert.deepEqual([...redirects.map((row) => row.from)].sort(), oldpaths.sort());
assert.equal(redirects.filter((row) => row.action === 'REVIEW').length, 4);
for (const row of redirects) {
  if (row.action === 'REVIEW') { assert.equal(row.status, null); assert.equal(row.to, null); continue; }
  if (row.status !== 301 && row.status !== 200) continue;
  assert.ok(row.to);
  assert.ok(existsSync(join(dist, row.to === '/' ? 'index.html' : row.to.slice(1) + '/index.html')), 'Нет цели ' + row.to);
  if (row.status === 301) {
    assert.notEqual(row.to, '/');
    assert.notEqual(row.from, row.to);
    assert.ok(!redirects.some((next) => next.from === row.to && next.status === 301), 'Цепочка ' + row.from);
  }
}
const titles = new Set();
let pages = 0;
for (const file of walk(dist).filter((file) => file.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const path = relative(dist, file).replaceAll('\\', '/').replace(/\/index\.html$/, '').replace(/^index\.html$/, '').replace(/\.html$/, '');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  assert.ok(title, 'Нет title: ' + path);
  assert.ok(!titles.has(title), 'Повтор title: ' + path); titles.add(title);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, 'H1: ' + path);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, 'Canonical: ' + path);
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.ok(canonical?.endsWith('/' + path), 'Canonical не соответствует пути: ' + path);
  assert.ok(/<meta name="description" content="[^"]+"/.test(html), 'Description: ' + path);
  assert.ok(/property="og:title"/.test(html) && /property="og:url"/.test(html), 'OG: ' + path);
  for (const section of ['/news', '/documents']) if (!published_routes.includes(section)) assert.ok(!html.includes(`href="${section}`), 'Скрытый раздел: ' + section);
  if (path === '404' || (!legal_content_approved && ['cookies', 'consent'].includes(path))) assert.ok(/name="robots" content="noindex, nofollow"/.test(html), 'Черновик индексируется: ' + path);
  pages++;
}
const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
if (/Disallow: \/\s*$/.test(robots)) assert.ok(!sitemap.includes('<loc>'), 'Staging sitemap должен быть пуст');
for (const loc of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const path = new URL(loc[1]).pathname;
  assert.notEqual(path, '/404');
  if (!legal_content_approved) assert.ok(!['/cookies', '/consent'].includes(path));
  if (path === '/news' || path.startsWith('/news/') || path === '/documents') assert.ok(published_routes.includes(path));
  assert.ok(existsSync(join(dist, path === '/' ? 'index.html' : path.slice(1) + '/index.html')));
}
console.log('check-seo: OK — ' + pages + ' страниц, 50 старых URL, 4 REVIEW, canonical/metadata/sitemap, без цепочек');

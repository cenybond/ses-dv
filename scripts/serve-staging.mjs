// Локальная проверка собранной статики, HTTP-статусов и CSP. Не production-хостинг.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { redirects } from '../src/data/redirects.ts';
import { published_routes } from '../src/data/publications.ts';
import { create_lead_handler } from '../server/leads.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const leads = create_lead_handler({ config: { enabled: false } });
export function create_staging_server() {
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/api/leads') return await leads(req, res);
      if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) return res.writeHead(404).end();
      const key = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
      const migration = published_routes.includes(key) ? undefined : redirects.find(entry => entry.from === key);
      if (migration?.status === 301 && migration.to) return res.writeHead(301, { Location: migration.to }).end();
      let status = migration?.status === 410 ? 410 : migration?.status === 404 || migration?.action === 'REVIEW' ? 404 : 200;
      let file = resolve(root, '.' + pathname);
      if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) return res.writeHead(404).end();
      try { if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html'); } catch { if (status !== 410) status = 404; }
      if (pathname === '/404.html') status = 404;
      if (![200, 404].includes(status) || status === 404) file = resolve(root, '404.html');
      let data;
      try { data = await readFile(file); } catch { file = resolve(root, '404.html'); data = await readFile(file); status = 404; }
      const hashes = extname(file) === '.html'
        ? [...data.toString().matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`) : [];
      res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
      res.writeHead(status, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = create_staging_server();
  const port = Number(process.env.STAGING_PORT || 4321);
  server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

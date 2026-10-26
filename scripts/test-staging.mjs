import assert from 'node:assert/strict';
import { create_staging_server } from './serve-staging.mjs';
import { redirects } from '../src/data/redirects.ts';
import { published_routes } from '../src/data/publications.ts';
const server = create_staging_server();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  let count = 0;
  for (const route of redirects) {
    const response = await fetch(origin + route.from, { redirect: 'manual' });
    assert.equal(response.status, published_routes.includes(route.from) ? 200 : route.status ?? 404, route.from);
    if (route.status === 301) assert.equal(response.headers.get('location'), route.to);
    if (route.status === 200) assert.match(response.headers.get('content-type'), /text\/html/);
    count++;
  }
  for (const path of ['/no-such-page', '/.env', '/.git/config', '/server/index.mjs', '/%5c..%5c.env']) assert.equal((await fetch(origin + path)).status, 404, path);
  const home = await fetch(origin);
  assert.equal(home.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await fetch(origin + '/api/leads', { method: 'POST', body: 'synthetic' })).status, 503);
  console.log(`test-staging: OK — ${count} старых URL, 404/410, защита служебных путей, CSP и disabled API`);
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

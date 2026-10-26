import { site_config, legal_content_approved, legal_paths } from '../data/site-config';
import { redirects } from '../data/redirects';
import { published_routes } from '../data/publications';
// Источник путей — полный реестр, REVIEW не создаёт публикуемый маршрут.
const paths = [...new Set(redirects.filter((item) => item.status === 200 || item.status === 301).map((item) => item.to).filter((path): path is string => !!path))];
if (legal_content_approved) paths.push('/consent', '/cookies');
paths.push(...published_routes);
export const GET = () => {
  const included = site_config.indexable ? paths.filter((path) => legal_content_approved || !legal_paths.includes(path)) : [];
  const body = included.sort().map((path) => `<url><loc>${site_config.origin}${path === '/' ? '/' : path}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

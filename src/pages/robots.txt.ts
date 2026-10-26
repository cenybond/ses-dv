import { site_config } from '../data/site-config';
export const GET = () => new Response(site_config.indexable
  ? `User-agent: *\nAllow: /\nSitemap: ${site_config.origin}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

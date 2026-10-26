// Безопасные значения сборки: production и аналитика включаются только явно.
export function make_site_config(env: Record<string, unknown>, reviewed_content = false) {
  const mode = env.PUBLIC_SITE_MODE === 'production' ? 'production' : 'staging';
  const value = String(env.PUBLIC_SITE_URL || 'https://ses-dv.ru');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_SITE_URL должен быть HTTPS origin без пути, параметров и учётных данных.');
  }
  const legal_approved = reviewed_content && env.PUBLIC_LEGAL_APPROVED === 'true';
  const metrica_id = /^\d{1,12}$/.test(String(env.PUBLIC_METRICA_ID || '')) && Number(env.PUBLIC_METRICA_ID) > 0
    ? Number(env.PUBLIC_METRICA_ID) : null;
  return {
    mode, origin: url.origin, legal_approved, metrica_id,
    indexable: mode === 'production' && legal_approved,
    analytics_enabled: mode === 'production' && legal_approved && env.PUBLIC_ANALYTICS_ENABLED === 'true' && metrica_id !== null,
  } as const;
}

// Меняется только вместе с утверждёнными юридическими текстами, не одним env-флагом.
export const legal_content_approved = false;
export const site_config = make_site_config(import.meta.env ?? {}, legal_content_approved);
export const legal_paths = ['/privacy', '/consent', '/cookies'];
export const page_indexable = (path: string) => site_config.indexable && path !== '/404' && (!legal_paths.includes(path) || legal_content_approved);

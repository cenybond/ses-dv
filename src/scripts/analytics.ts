import { read_consent } from './consent';

export const allowed_goals = new Set(['callback_click', 'services_click', 'projects_click', 'phone_click', 'email_click', 'form_open', 'form_start', 'lead_success', 'project_open', 'vacancy_response']);
type Metrica = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global { interface Window { ym?: Metrica; } }

export function init_analytics() {
  const config = document.querySelector<HTMLElement>('[data-cookie-banner]');
  const id = Number(config?.dataset.metricaId);
  const configured = config?.dataset.analyticsAvailable === 'true' && Number.isSafeInteger(id) && id > 0
    && location.origin === config?.dataset.siteOrigin;
  let active = false;
  let loading = false;
  let library: HTMLScriptElement | null = null;
  let generation = 0;
  const allowed = () => configured && read_consent()?.analytics === true;
  const purge = () => {
    // Удаляем лишь доступные first-party cookie Метрики. HttpOnly и чужой домен недоступны.
    const domains = ['', location.hostname, `.${location.hostname}`];
    for (const raw of document.cookie.split(';')) {
      const name = raw.trim().split('=')[0];
      if (!/^_ym_[a-zA-Z0-9_]+$/.test(name || '')) continue;
      for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? `; Domain=${domain}` : ''}`;
    }
    try {
      for (const key of Object.keys(localStorage)) if (/^_ym_/.test(key)) localStorage.removeItem(key);
    } catch { /* Недоступное хранилище не мешает отзыву согласия. */ }
  };
  const stop = () => {
    generation += 1;
    if (active) window.ym?.(id, 'destruct');
    active = false;
    if (window.ym?.a) window.ym.a = [];
    library?.remove();
    loading = false;
    purge();
  };
  const start = () => {
    if (!allowed() || active || loading) return;
    loading = true;
    const ticket = ++generation;
    // Очередь создаётся только после согласия. До загрузки в ней нет init/целей.
    window.ym ||= Object.assign((...args: unknown[]) => { window.ym?.a?.push(args); }, { a: [] as unknown[][], l: Date.now() });
    library = document.createElement('script');
    library.async = true;
    library.src = 'https://mc.yandex.ru/metrika/tag.js';
    library.referrerPolicy = 'no-referrer';
    library.onload = () => {
      if (ticket !== generation) return;
      loading = false;
      if (!allowed()) { stop(); return; }
      window.ym?.(id, 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, accurateTrackBounce: false, trackHash: false, ecommerce: false, disableYtm: true, sendTitle: false });
      active = true;
      // Только canonical: query/hash и внешний referer в просмотр не передаются.
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
      if (canonical) window.ym?.(id, 'hit', canonical, { referer: '', title: '' });
    };
    library.onerror = () => { if (ticket === generation) { loading = false; library?.remove(); } };
    document.head.append(library);
  };
  const goal = (name: unknown) => {
    if (!allowed()) { if (active || loading) stop(); return; }
    if (active && typeof name === 'string' && allowed_goals.has(name)) window.ym?.(id, 'reachGoal', name);
  };
  window.addEventListener('ses:consent', () => { if (allowed()) start(); else stop(); });
  window.addEventListener('ses:goal', (event) => goal((event as CustomEvent<{ goal?: unknown }>).detail?.goal));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !allowed()) stop(); });
  document.addEventListener('click', (event) => {
    // Окно проекта (плитка галереи или пункт списка «Еще работы») открывается без перехода по адресу.
    if (event.target instanceof Element && event.target.closest('[data-project-modal],[data-modal-open^="project-modal-"]')) goal('project_open');
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a') : null;
    if (!target) return;
    const href = target.getAttribute('href') || '';
    if (href.startsWith('tel:')) goal('phone_click');
    else if (href.startsWith('mailto:')) goal('email_click');
    else if (href === '/#home-services') goal('services_click');
    else if (href === '/#home-projects') goal('projects_click');
  });
  start();
}

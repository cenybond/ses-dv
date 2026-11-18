// Главная: пункты меню (шапка, шторка и подвал) плавно ведут к своим разделам той же страницы, а «Контакты» — вниз, к подвалу.
// Ссылки в разметке остаются настоящими (/about, /#home-services…): без JS и на других страницах они открывают страницы.
import { lenis, reducedMotion } from './smooth-scroll.ts';

// Ключ ссылки: путь без завершающего слэша и якорь (`/#home-services` — раздел услуг на главной).
const keyOf = (link: HTMLAnchorElement): string => {
  const url = new URL(link.href, location.href);
  return (url.pathname.replace(/\/+$/, '') || '/') + url.hash;
};

const sections: Record<string, () => HTMLElement | null> = {
  '/about': () => document.getElementById('home-about-title')?.closest('section') ?? null,
  '/#home-services': () => document.getElementById('home-services')?.closest('section') ?? null,
  '/#home-projects': () => document.getElementById('home-projects')?.closest('section') ?? null,
};

// Какой пункт подчёркнут сейчас: раздел, на котором стоит экран («Контакты» — блок обращения и подвал). Пока идёт прокрутка по клику, держится выбранный пункт.
let lock: string | null = null;

const go = (href: string, fromFooter = false): boolean => {
  const offset = -(document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) - 12;
  const to = (target: number | HTMLElement, opts: { offset?: number } = {}) => {
    if (lenis && !reducedMotion) lenis.scrollTo(target, { ...opts, duration: 1.4, force: true, onComplete: () => { lock = null; spy(); } });
    else { lock = null; window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + window.scrollY + (opts.offset ?? 0) }); }
  };
  lock = href;
  window.setTimeout(() => { if (lock === href) { lock = null; spy(); } }, 2400); // страховка: onComplete не придёт, если страница уже на месте
  if (href === '/') { to(0); return true; }
  // «Контакты» в шапке и шторке — вниз, к подвалу; в самом подвале страница и так внизу, поэтому пункт ведёт к блоку с формой.
  if (href === '/contacts' && !fromFooter) { to(document.documentElement.scrollHeight - window.innerHeight); return true; }
  if (href === '/contacts') { const form = document.getElementById('request'); if (!form) { lock = null; return false; } to(form, { offset }); return true; }
  const section = sections[href]?.();
  if (!section) { lock = null; return false; }
  to(section, { offset });
  return true;
};

if (location.pathname.replace(/\/+$/, '') === '') {
  document.querySelectorAll<HTMLAnchorElement>('.site-header .nav a, #menu .menu-list a, .site-footer #site-nav a, .site-header .logo, .site-header a[href="/"]').forEach((link) => {
    const href = keyOf(link);
    if (href !== '/' && !(href in sections) && href !== '/contacts') return;
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      document.querySelector<HTMLDialogElement>('#menu[open]')?.close();
      go(href, link.closest('.site-footer') !== null);
    });
  });
}

// Подчёркивание пункта шапки следует за прокруткой: у активного aria-current (подчёркивание рисует система, плавно, transform scaleX), у остальных снят.
const navLinks = new Map<string, HTMLAnchorElement>();
document.querySelectorAll<HTMLAnchorElement>('.site-header .nav a').forEach((link) => navLinks.set(keyOf(link), link));
const initial = new Map([...navLinks.values()].map((link) => [link, link.getAttribute('aria-current')] as const));
const marks: [string, () => HTMLElement | null][] = [
  ['/about', sections['/about']],
  ['/#home-services', sections['/#home-services']],
  ['/#home-projects', sections['/#home-projects']],
  ['/contacts', () => document.getElementById('request')],
];

function spy(): void {
  if (location.pathname.replace(/\/+$/, '') !== '' || !navLinks.size) return;
  let active = lock;
  if (!active) {
    const probe = window.innerHeight * 0.4;
    active = '/';
    for (const [href, find] of marks) if ((find()?.getBoundingClientRect().top ?? Infinity) <= probe) active = href;
    if (window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4) active = '/contacts';
  }
  navLinks.forEach((link, href) => {
    if (href === active) link.setAttribute('aria-current', initial.get(link) ?? 'location');
    else link.removeAttribute('aria-current');
  });
}

let queued = false;
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; spy(); }); } };
window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule);
spy();

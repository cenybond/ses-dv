// Главная: пункты меню (шапка, шторка и подвал) плавно ведут к своим разделам той же страницы, а «Контакты» — вниз, к подвалу.
// Ссылки в разметке остаются настоящими (/about, /services…): без JS и на других страницах они открывают страницы.
import { lenis, reducedMotion, ScrollTrigger } from './smooth-scroll.ts';
import { isHomePath } from './deeplinks.ts';
import { toLocal } from './base-path.ts';
import { afterMobileMenuCloses } from './mobile-menu.ts';

// Ключ ссылки: путь без завершающего слэша и якорь (`/services` — раздел услуг на главной).
const keyOf = (link: HTMLAnchorElement): string => {
  const url = new URL(link.href, location.href);
  return (toLocal(url.pathname).replace(/\/+$/, '') || '/') + url.hash;
};

const sections: Record<string, () => HTMLElement | null> = {
  '/about': () => document.getElementById('home-about-title')?.closest('section') ?? null,
  '/services': () => document.getElementById('home-services')?.closest('section') ?? null,
  '/projects': () => document.getElementById('home-projects')?.closest('section') ?? null,
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

if (isHomePath()) {
  document.querySelectorAll<HTMLAnchorElement>('.site-header .nav a, #menu .menu-list a, .site-footer #site-nav a, .site-header .logo, .site-header a[href="/"], .hero__btn').forEach((link) => {
    const href = keyOf(link);
    if (href !== '/' && !(href in sections) && href !== '/contacts') return;
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      afterMobileMenuCloses(() => go(href, link.closest('.site-footer') !== null));
    });
  });
}

// Подчёркивание пункта шапки следует за прокруткой: у активного aria-current (подчёркивание рисует система, плавно, transform scaleX), у остальных снят.
const navLinks = new Map<string, HTMLAnchorElement>();
document.querySelectorAll<HTMLAnchorElement>('.site-header .nav a').forEach((link) => navLinks.set(keyOf(link), link));
const initial = new Map([...navLinks.values()].map((link) => [link, link.getAttribute('aria-current')] as const));
const marks: [string, () => HTMLElement | null][] = [
  ['/about', sections['/about']],
  ['/services', sections['/services']],
  ['/projects', sections['/projects']],
  ['/contacts', () => document.getElementById('request')],
];

// Положения разделов в документе меряются заранее — при загрузке и когда меняется раскладка (ResizeObserver на <body>, смена размера окна),
// а не в каждом кадре прокрутки: getBoundingClientRect и scrollHeight после записей стилей анимациями заставляли браузер пересчитывать стили
// посреди кадра (замер на CPU 4×: до 360 мс за проход hero). Позиция прокрутки берётся у Lenis — её чтение раскладку не трогает.
let tops: [string, number][] = [];
let viewport = window.innerHeight;
let maxScroll = 0;
function measure(): void {
  const y = window.scrollY;
  tops = marks.map(([href, find]) => [href, (find()?.getBoundingClientRect().top ?? Infinity) + y]);
  viewport = window.innerHeight;
  maxScroll = document.documentElement.scrollHeight - viewport;
}
const scrollPos = () => lenis?.scroll ?? window.scrollY;

let shown: string | null | undefined;
function spy(): void {
  if (!isHomePath() || !navLinks.size) return;
  let active = lock;
  if (!active) {
    const probe = scrollPos() + viewport * 0.4;
    active = '/';
    for (const [href, top] of tops) if (top <= probe) active = href;
    if (scrollPos() >= maxScroll - 4) active = '/contacts';
  }
  // Атрибуты трогаем только при смене пункта: запись даже того же значения сбрасывает стили ссылок.
  if (active === shown) return;
  shown = active;
  navLinks.forEach((link, href) => {
    if (href === active) link.setAttribute('aria-current', initial.get(link) ?? 'location');
    else link.removeAttribute('aria-current');
  });
}

let queued = false;
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; spy(); }); } };
window.addEventListener('scroll', schedule, { passive: true });
if (isHomePath() && navLinks.size) {
  const remeasure = () => { measure(); schedule(); };
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  // Раскладка меняется и без изменения высоты <body> (hero-frame.ts, пересчёт ScrollTrigger) — тогда тоже перемериваем.
  ScrollTrigger.addEventListener('refresh', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
}
measure();
spy();

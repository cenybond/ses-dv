// Шапка главной: белая полоса перетекает в три плавающие плашки (логотип, меню, действия) по мере прокрутки. Прогресс 0…1 пишется в --header-p,
// геометрию плашек в состоянии полосы измеряем здесь. Подключается на главной (hero-frame.ts) и на юридических страницах.
import { gsap } from './smooth-scroll.ts';

const header = document.querySelector<HTMLElement>('.site-header--hero');
if (header) {
  // Плашки в состоянии полосы стыкуются встык: логотип тянется до края экрана и до меню, меню — до действий, действия — до края.
  const logo = header.querySelector<HTMLElement>('.logo');
  const nav = header.querySelector<HTMLElement>('.nav');
  const actions = header.querySelector<HTMLElement>('.site-header__actions');
  const measure = () => {
    if (!logo || !nav || !actions) return;
    const vw = document.documentElement.clientWidth;
    const l = logo.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    const a = actions.getBoundingClientRect();
    const navShown = n.width > 0;
    const set = (el: HTMLElement, left: number, right: number) => {
      el.style.setProperty('--ext-l', `${Math.max(0, left).toFixed(2)}px`);
      el.style.setProperty('--ext-r', `${Math.max(0, right).toFixed(2)}px`);
    };
    set(logo, l.left, (navShown ? n.left : a.left) - l.right);
    set(nav, 0, 0);
    set(actions, navShown ? a.left - n.right : 0, vw - a.right);
    header.classList.add('is-morph');
  };
  // Телефон и планшет (≤ 960 px, решение владельца 2026-11-19): плашки сразу скруглённые, без перетекания из полосы — прогресс всегда 1.
  const narrow = window.matchMedia('(max-width: 960px)');
  const setProgress = (p: number) => header.style.setProperty('--header-p', (narrow.matches ? 1 : p).toFixed(3));

  // Переход на первых 180 px прокрутки: без порога и без скачка. Прогресс сглажен (ease + инерция scrub),
  // поэтому плашки «догоняют» прокрутку мягко, а не рывками колеса мыши.
  const morph = { p: 0 };
  gsap.to(morph, {
    p: 1,
    ease: 'power2.inOut',
    onUpdate: () => setProgress(morph.p),
    scrollTrigger: { start: 0, end: () => 180, scrub: 0.9, invalidateOnRefresh: true, onRefresh: measure },
  });
  measure();
  setProgress(morph.p);
  narrow.addEventListener('change', () => setProgress(morph.p));
  new ResizeObserver(measure).observe(header);
  void document.fonts?.ready.then(measure);
}


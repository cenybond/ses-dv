// Плавная прокрутка (библиотека Lenis) на всех страницах, связанная с GSAP ScrollTrigger:
// Lenis крутится в тикере GSAP, а каждый его кадр обновляет ScrollTrigger — анимации идут синхронно с прокруткой.
// Колесо и тачпад — с инерцией, касание на телефоне нативное. При «уменьшении движения» Lenis не включается.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export let lenis: Lenis | null = null;

if (!reducedMotion) {
  const headerOffset = -(document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) - 12;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)), anchors: { offset: headerOffset } });
  lenis.on('scroll', ScrollTrigger.update);
  // Lenis — первым в кадре (prioritize): прокрутка и ScrollTrigger.update идут до того, как твины GSAP запишут стили.
  // Иначе window.scrollTo после этих записей заставляет браузер пересчитывать стили прямо внутри кадра (замер на CPU 4×: до 260 мс за проход hero).
  gsap.ticker.add((time) => lenis?.raf(time * 1000), false, true);
  gsap.ticker.lagSmoothing(0);
  // Открытое меню-шторка или диалог заявки (<dialog open>) — страница под ними не прокручивается.
  const sync = () => (document.querySelector('dialog[open]') ? lenis?.stop() : lenis?.start());
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
}

export { gsap, ScrollTrigger };

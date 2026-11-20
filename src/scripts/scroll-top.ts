// Кнопка «Наверх»: показывается после 80 % высоты экрана прокрутки, ведёт к началу страницы (плавно через Lenis; без него — нативно).
// Баннер cookie стоит в том же углу, поэтому пока он виден, кнопка поднимается на его высоту (--scroll-top-lift).
import { lenis, reducedMotion } from './smooth-scroll.ts';

const button = document.querySelector<HTMLButtonElement>('[data-scroll-top]');

if (button) {
  let shown = false;
  const update = () => {
    const next = window.scrollY > window.innerHeight * 0.8;
    if (next === shown) return;
    shown = next;
    button.classList.toggle('is-visible', next);
    button.inert = !next;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  const banner = document.querySelector<HTMLElement>('.cookie-banner');
  if (banner) {
    const lift = () => button.style.setProperty('--scroll-top-lift', banner.hidden || !banner.offsetHeight ? '0px' : `${banner.offsetHeight + 12}px`);
    new ResizeObserver(lift).observe(banner);
    new MutationObserver(lift).observe(banner, { attributes: true, attributeFilter: ['hidden'] });
    lift();
  }

  button.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

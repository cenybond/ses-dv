// Заголовок hero: каждая строка поднимается из маски (.hero__line), строки идут друг за другом со сдвигом 0.08 с.
// Анимируется CSS-переменная --line-y (110% → 0%), а не transform: так GSAP не спорит со стартовым положением из CSS,
// которое скрывает текст до запуска скрипта (без мигания). При «уменьшении движения» — без анимации.
import { gsap, reducedMotion } from './smooth-scroll.ts';

const lines = document.querySelectorAll<HTMLElement>('.hero__line-in');

// Страховка в hero.css (анимация hero-line-in) поднимает строки сама, если скрипт не успел за 2,5 с. Уже начавшуюся не перехватываем —
// иначе текст снова спрятался бы и выехал второй раз.
const fallbackStarted = () =>
  (lines[0].getAnimations?.() ?? []).some((animation) => {
    if (!('animationName' in animation) || (animation as CSSAnimation).animationName !== 'hero-line-in') return false;
    const timing = animation.effect?.getComputedTiming();
    return Number(timing?.localTime ?? 0) >= Number(timing?.delay ?? 0);
  });

if (lines.length && !reducedMotion) {
  const run = () => {
    if (fallbackStarted()) return;
    document.documentElement.classList.add('hero-title-js');
    gsap.fromTo(
      lines,
      { '--line-y': '110%' },
      { '--line-y': '0%', duration: 1, ease: 'power4.out', stagger: 0.08, delay: 0.1 },
    );
  };
  // Шрифт успевает загрузиться — строки не прыгают после старта.
  void (document.fonts?.ready ?? Promise.resolve()).then(run);
}

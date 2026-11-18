// «Аккордеон» проектов на главной (React Bits AccordionGallery, перенос на Astro + GSAP): активная панель раскрывается, остальные сжимаются и слегка наклоняются.
// Активной панель делают наведение, фокус, касание и стрелки; нажатие на раскрытую панель открывает окно проекта (src/scripts/list-modal.ts, событие `modal:open`).
import { gsap, reducedMotion } from './smooth-scroll.ts';

const EXPAND_RATIO = 0.52; // доля ширины раскрытой панели
const EXPAND_RATIO_NARROW = 0.62; // на телефоне полос шесть в одной строке, раскрытой нужно больше места под подпись
const TILT = 8; // наклон свёрнутых панелей, градусы
const DURATION = 0.6;
const EASE = 'power3.out';
const CTA_WEIGHT = 1.5; // совпадает с flex-grow .pg__panel--cta в projects-gallery.css

document.querySelectorAll<HTMLElement>('[data-pg]').forEach((root) => {
  // Плитка «Еще работы» (.pg__panel--cta) не раскрывается: в расчёте только её вес (чуть шире свёрнутой панели), ширину она держит CSS.
  // Видимы не все панели: на узких экранах последние скрыты CSS (display:none), в расчёте участвуют только видимые.
  const allPanels = Array.from(root.querySelectorAll<HTMLElement>('.pg__panel:not(.pg__panel--cta)'));
  if (!allPanels.length) return;
  let panels = allPanels;
  let count = panels.length;
  const refreshPanels = () => {
    panels = allPanels.filter((panel) => panel.offsetParent !== null);
    count = panels.length;
  };
  refreshPanels();
  if (!count) return;

  const narrow = window.matchMedia('(max-width: 640px)');
  const hoverable = window.matchMedia('(hover: hover)');
  // На телефоне плитка «Еще работы» стоит отдельной строкой под полосами и в расчёте ширины не участвует.
  const growFor = (isNarrow: boolean) => {
    const ratio = isNarrow ? EXPAND_RATIO_NARROW : EXPAND_RATIO;
    return count > 1 ? (ratio * (count - 1 + (isNarrow ? 0 : CTA_WEIGHT))) / (1 - ratio) : 1;
  };
  let active = Math.min(Math.max(Number(root.dataset.pgDefault ?? 2), 0), count - 1);

  const layout = (animate: boolean) => {
    const duration = animate && !reducedMotion ? DURATION : 0;
    const tilt = narrow.matches || reducedMotion ? 0 : TILT;
    const grow = growFor(narrow.matches);
    panels.forEach((panel, i) => {
      const on = i === active;
      const rotateY = on ? 0 : i < active ? tilt : -tilt;
      gsap.to(panel, { flexGrow: on ? grow : 1, rotateY, duration, ease: EASE, overwrite: 'auto' });
      panel.classList.toggle('is-active', on);
      const link = panel.querySelector('.pg__link');
      if (on) link?.setAttribute('aria-current', 'true');
      else link?.removeAttribute('aria-current');
    });
  };

  const setActive = (index: number) => {
    const next = (index + count) % count;
    if (next === active) return;
    active = next;
    layout(true);
  };

  // Слушатели — на всех панелях (скрытые на узком экране оживут при расширении окна); номер в ряду считается в момент события.
  allPanels.forEach((panel) => {
    const link = panel.querySelector<HTMLElement>('.pg__link');
    const index = () => panels.indexOf(panel);
    panel.addEventListener('mouseenter', () => {
      if (hoverable.matches && index() >= 0) setActive(index());
    });
    link?.addEventListener('focus', () => { if (index() >= 0) setActive(index()); });
    // Нажатие на свёрнутую панель раскрывает её, на раскрытую — открывает окно проекта.
    link?.addEventListener('click', () => {
      const i = index();
      if (i < 0) return;
      if (i !== active) setActive(i);
      else document.getElementById(link.dataset.projectModal ?? '')?.dispatchEvent(new CustomEvent('modal:open', { detail: { trigger: link } }));
    });
    link?.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
      const i = index();
      if (!step || i < 0) return;
      event.preventDefault();
      panels[(i + step + count) % count]?.querySelector<HTMLElement>('.pg__link')?.focus();
    });
  });

  const controls = root.querySelector<HTMLElement>('.pg__controls');
  controls?.removeAttribute('hidden');
  root.querySelector('[data-pg-prev]')?.addEventListener('click', () => setActive(active - 1));
  root.querySelector('[data-pg-next]')?.addEventListener('click', () => setActive(active + 1));
  // Меняется число видимых полос (границы 960 и 640 px) — пересчитываем ряд.
  const relayout = () => {
    refreshPanels();
    active = Math.min(active, count - 1);
    layout(false);
  };
  narrow.addEventListener('change', relayout);
  window.matchMedia('(max-width: 960px)').addEventListener('change', relayout);
  layout(false);
});

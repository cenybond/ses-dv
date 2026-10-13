// Шапка: прозрачная над hero, светлая после прокрутки на 24 px. `data-header="solid"` — всегда светлая (внутренние страницы).
// Перенесено из design/system/system.js (PHASE 4); без JS solid-шапка светлая по классу в разметке.
export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const always = header.dataset.header === 'solid';
  const sync = () => header.classList.toggle('is-solid', always || window.scrollY > 24);
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

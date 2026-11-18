// Блок обращения на главной закрепляется под шапкой, пока подвал поднимается снизу и «наплывает» на пустое место под ним.
// Путь закрепления (--cta-travel) равен свободной высоте экрана под блоком (за вычетом отступа до подвала): подвал стартует у нижнего
// края экрана и останавливается рядом с блоком, не закрывая ни поля, ни заголовок. Без JS, на узких экранах и при «уменьшении движения» блок идёт обычным потоком.
const section = document.querySelector<HTMLElement>('.home-cta');
const pin = section?.querySelector<HTMLElement>('.home-cta__pin');

if (section && pin) {
  const wide = window.matchMedia('(min-width: 961px) and (prefers-reduced-motion: no-preference)');
  const update = () => {
    let travel = 0;
    if (wide.matches) {
      const top = Number.parseFloat(getComputedStyle(pin).top) || 0;
      const gap = Number.parseFloat(getComputedStyle(section).paddingBottom) || 0;
      travel = Math.max(0, document.documentElement.clientHeight - top - pin.offsetHeight - gap);
    }
    section.style.setProperty('--cta-travel', `${Math.round(travel)}px`);
  };
  new ResizeObserver(update).observe(pin);
  window.addEventListener('resize', update);
  wide.addEventListener('change', update);
  void document.fonts?.ready.then(update);
  update();
}

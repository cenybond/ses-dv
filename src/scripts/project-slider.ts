// Листание снимков в окне проекта: лента со scroll-snap (смахивание пальцем и колесо работают сами), кнопки «назад/вперёд» и счётчик «1 / N».
// Если снимок один (или только заглушка), кнопок в разметке нет и скрипт ничего не делает.
document.querySelectorAll<HTMLElement>('[data-slider]').forEach((root) => {
  const track = root.querySelector<HTMLElement>('[data-slides]');
  const count = root.querySelector<HTMLElement>('[data-slide-count]');
  if (!track || !count) return;
  const total = track.children.length;
  const index = () => Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
  const go = (step: number) => {
    const next = Math.min(Math.max(index() + step, 0), total - 1);
    track.scrollTo({ left: next * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  track.addEventListener('scroll', () => { count.textContent = `${index() + 1} / ${total}`; }, { passive: true });
  root.querySelector('[data-slide-prev]')?.addEventListener('click', () => go(-1));
  root.querySelector('[data-slide-next]')?.addEventListener('click', () => go(1));
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
  });
});

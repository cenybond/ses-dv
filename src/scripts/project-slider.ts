// Фото в окне проекта (решение владельца 2026-11-20): блок под фото неподвижен (размер, стрелки по бокам), снимки едут влево-вправо, а рамка, в которой они едут,
// плавно меняет форму под формат каждого снимка. Положение ленты — число `--i` (номер снимка) на ленте: CSS-переход сдвигает её на `--i` ширин рамки;
// форма рамки — число `--r` (ширина / высота) на блоке `.project-modal__stage`: CSS-переход (@property) ведёт его к формату нового снимка,
// размер рамки из `--r` считает сам CSS (projects-gallery.css). Листание: кнопки, стрелки клавиатуры, смахивание пальцем или мышью.
// Событие `slider:change` (с номером снимка) сообщает адресу окна, какой снимок показан. Если снимок один, кнопок и счётчика в разметке нет, а блока снимков нет вовсе, если фото нет.
document.querySelectorAll<HTMLElement>('[data-slider]').forEach((root) => {
  const stage = root.querySelector<HTMLElement>('.project-modal__stage');
  const track = root.querySelector<HTMLElement>('[data-slides]');
  const count = root.querySelector<HTMLElement>('[data-slide-count]');
  const prev = root.querySelector<HTMLButtonElement>('[data-slide-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-slide-next]');
  if (!stage || !track) return;
  const slides = Array.from(track.children) as HTMLElement[];
  const total = slides.length;
  const ratio = (slide: HTMLElement) => slide.dataset.ratio ?? '1.3333';
  let current = 0;

  // Соседние снимки подгружаем заранее (остальные ленивые, браузер их не качает, пока они за краем рамки).
  const warm = (index: number) => {
    [index - 1, index + 1].forEach((neighbour) => {
      const image = slides[neighbour]?.querySelector('img');
      if (image && image.loading === 'lazy') image.loading = 'eager';
    });
  };

  const apply = (warmNeighbours = true) => {
    track.style.setProperty('--i', String(current));
    stage.style.setProperty('--r', ratio(slides[current]));
    track.dataset.index = String(current);
    stage.dispatchEvent(new CustomEvent('slider:change', { bubbles: true, detail: { index: current } })); // адрес окна следует за снимком (deeplinks.ts)
    if (count) count.textContent = `${current + 1} / ${total}`;
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === total - 1;
    if (warmNeighbours) warm(current);
  };

  const go = (index: number) => {
    index = Math.min(Math.max(index, 0), total - 1);
    if (index === current) return;
    current = index;
    apply();
  };

  // При открытии окна (list-modal.ts) всегда первый снимок и без анимации.
  // Формат первого снимка задаёт скрипт, а не атрибут style: строгая политика CSP сайта (style-src 'self') блокирует встроенные стили в разметке.
  const reset = () => {
    const dialog = root.closest('dialog');
    // Ссылка вида /projects/<проект>?photo=3 открывает окно сразу на нужном снимке (deeplinks.ts кладёт номер в `data-start`).
    const start = Math.min(Math.max(Number(dialog?.dataset.start ?? 0) || 0, 0), total - 1);
    if (dialog) delete dialog.dataset.start;
    stage.style.transition = 'none';
    track.style.transition = 'none';
    current = start;
    apply();
    void stage.offsetWidth;
    stage.style.transition = '';
    track.style.transition = '';
  };
  root.closest('dialog')?.addEventListener('slider:reset', reset);
  // При загрузке страницы окно закрыто: только начальное положение и формат рамки. Соседние снимки не подгружаем (иначе каждое из 14 окон
  // качало бы второй снимок сразу при загрузке) и раскладку принудительно не пересчитываем — это делает reset() при открытии окна.
  apply(false);
  if (total < 2) return;

  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1); }
  });
  // Смахивание: палец или мышь по фото, не по кнопкам.
  let startX = 0;
  let startY = 0;
  let tracking = false;
  stage.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  });
  stage.addEventListener('pointerup', (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });
});

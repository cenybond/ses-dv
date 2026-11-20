// Hero главной на GSAP ScrollTrigger.
// 1. Шапка: белая полоса перетекает в три плавающие плашки (логотип, меню, действия). Прогресс прокрутки 0…1 пишется в --header-p,
//    геометрию плашек в состоянии полосы измеряем здесь.
// 2. Hero «залипает» (CSS sticky в .hero-track) на время проигрывания кадров видео: камера уходит от здания под землю, к кабелям.
//    Кадры лежат в design/client-preview/hero/frames (scripts/build-hero-frames.py), кадр 0 — само фото 1 в 1.
//    Кадры скачиваются файлами, а в память разжимаются (ImageBitmap, вне основного потока) только в окне вокруг текущего положения:
//    слабые компьютеры не держат сотни мегабайт и не декодируют кадр в момент отрисовки. Холст всегда одного размера (размер кадра),
//    подгонку под карточку делает CSS (object-fit: cover) на видеокарте, поэтому раскрытие полей не пересоздаёт холст.
//    Белые поля вокруг карточки и её скругление уходят в начале пути (--hero-k: 1 → 0), потом идут кадры, в конце — небольшая пауза
//    на последнем кадре и hero уезжает вместе со страницей. Заголовок, подзаголовок и кнопка стоят на месте, пока верхний край блока
//    .home-rest не покажется снизу экрана; дальше они «приклеены» к его верхнему краю и поднимаются вместе с ним (--hero-out: 0 → 1, сдвиг
//    ровно на пройденный блоком путь), поэтому отступ от кнопки до края блока остаётся тем же, а блок вытесняет текст за верх экрана.
// Без JS и при «уменьшении движения» остаётся обычный hero с фото.
import { gsap, reducedMotion } from './smooth-scroll.ts';
import './header-morph.ts'; // шапка: полоса → плашки

const track = document.querySelector<HTMLElement>('.hero-track');
const hero = track?.querySelector<HTMLElement>('.hero');
const card = hero?.querySelector<HTMLElement>('.hero__card');
const canvas = card?.querySelector<HTMLCanvasElement>('.hero__frames');
// alpha: false — холст непрозрачный, каждый кадр целиком перекрывает предыдущий, очищать его не нужно.
const ctx = canvas?.getContext('2d', { alpha: false });

/* ---------- Hero: поля, кадры, закрепление ---------- */
// Телефон и планшет (≤ 960 px, решение владельца 2026-11-19): вертикальное фото без кадров и закрепления — анимацию не запускаем.
const narrowQuery = window.matchMedia('(max-width: 960px)');
if (track && hero && card && canvas && ctx && !reducedMotion && !narrowQuery.matches && 'createImageBitmap' in window) {
  const urls: string[] = JSON.parse(canvas.dataset.framesLg ?? '[]');
  const last = urls.length - 1;

  // Доли пути прокрутки: поля уходят на первых OPEN, кадры идут до PLAY, дальше пауза на последнем кадре.
  const OPEN = 0.25;
  const PLAY = 0.94;
  // Окно разжатых кадров: впереди по ходу прокрутки больше, позади меньше (около 16 кадров ≈ 90 МБ вместо всех 61).
  const AHEAD = 11;
  const BEHIND = 4;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const easeOut = (t: number) => 1 - (1 - t) ** 3;

  const state = { p: 0 };
  const blobs: (Blob | undefined)[] = new Array(urls.length);
  const bitmaps = new Map<number, ImageBitmap>();
  const pending = new Set<number>();
  let frame = 0; // текущее дробное положение на ленте кадров
  let dir = 1; // направление прокрутки: 1 — вниз
  let version = 0; // растёт, когда меняется набор готовых кадров
  let lastKey = '';
  let lastK = -1;
  let active = true; // hero в зоне видимости

  const span = () => {
    const c = Math.floor(frame);
    return [Math.max(0, c - (dir > 0 ? BEHIND : AHEAD)), Math.min(last, c + 1 + (dir > 0 ? AHEAD : BEHIND))] as const;
  };
  const drop = (i: number) => {
    bitmaps.get(i)?.close();
    bitmaps.delete(i);
  };
  const decode = (i: number) => {
    const blob = blobs[i];
    if (!blob || bitmaps.has(i) || pending.has(i)) return;
    pending.add(i);
    createImageBitmap(blob).then(
      (bitmap) => {
        pending.delete(i);
        const [lo, hi] = span();
        if (!active || i < lo || i > hi || bitmaps.has(i)) return bitmap.close();
        bitmaps.set(i, bitmap);
        version++;
        render();
      },
      () => pending.delete(i),
    );
  };
  // Держим в памяти кадры окна, остальные освобождаем; ближайшие к текущему разжимаем первыми.
  const sync = () => {
    const [lo, hi] = span();
    for (const i of [...bitmaps.keys()]) if (i < lo || i > hi) drop(i);
    if (!active) return;
    const c = Math.floor(frame);
    for (let d = 0; d <= Math.max(c - lo, hi - c); d++) {
      if (c + d <= hi) decode(c + d);
      if (d && c - d >= lo) decode(c - d);
    }
  };

  const draw = (bitmap: ImageBitmap, alpha: number) => {
    // Размер холста — размер кадра; меняется только при первой отрисовке (после смены размера холст пустеет).
    if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(bitmap, 0, 0);
  };
  const nearest = (i: number) => {
    for (let d = 0; d <= last; d++) {
      const hit = bitmaps.get(i - d) ?? bitmaps.get(i + d);
      if (hit) return hit;
    }
    return undefined;
  };

  const render = () => {
    // Если окно стало узким уже после загрузки (поворот, эмуляция устройства), поля рамки не анимируем: на телефоне карточка всегда в рамке, без дёрганья.
    if (narrowQuery.matches) {
      hero.style.setProperty('--hero-k', '1');
      hero.style.setProperty('--hero-out', '0');
      return;
    }
    const p = state.p;
    const k = Number((1 - easeOut(clamp(p / OPEN))).toFixed(4));
    if (k !== lastK) {
      lastK = k;
      hero.style.setProperty('--hero-k', String(k));
    }

    const f = clamp(p / PLAY) * last;
    if (Math.abs(f - frame) > 0.0001) dir = f > frame ? 1 : -1;
    const moved = Math.floor(f) !== Math.floor(frame);
    frame = f;
    if (moved) sync();

    // Шаг 1/64 кадра: смешение соседних кадров остаётся плавным, а лишних перерисовок меньше.
    const key = `${Math.round(f * 64)}|${version}`;
    if (key === lastKey) return;
    const i0 = Math.floor(f);
    const t = f - i0;
    const a = bitmaps.get(i0);
    const b = i0 < last ? bitmaps.get(i0 + 1) : undefined;
    if (a && b && t > 0.02 && t < 0.98) {
      // Между двумя соседними кадрами — перекрёстное смешение: прокрутка идёт плавно, а не шагами по 61 кадру.
      draw(a, 1);
      draw(b, t);
    } else {
      const base = (t >= 0.5 ? (b ?? a) : (a ?? b)) ?? nearest(Math.round(f));
      if (!base) return;
      draw(base, 1);
    }
    ctx.globalAlpha = 1;
    lastKey = key;
    card.classList.add('has-frames');
  };

  gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: render,
    // Десктоп: путь кадров заканчивается, когда верхний край блока .home-rest (он заходит на последний экран дорожки) касается низа экрана.
    // scrub: true — сглаживание уже делает Lenis; вторая «догонялка» только удлиняла бы работу после остановки колеса.
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: () => `+=${Math.max(1, track.offsetHeight - 2 * window.innerHeight)}`,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
  // Уход текста привязан к самому блоку: от момента, когда его верхний край показался снизу экрана, до касания верха экрана.
  const rest = document.querySelector<HTMLElement>('.home-rest');
  if (rest) {
    gsap.to(hero, {
      ease: 'none',
      scrollTrigger: {
        trigger: rest,
        start: 'top bottom',
        end: 'top top',
        scrub: true, // без запаздывания: отступ от кнопки до края блока должен быть постоянным
        invalidateOnRefresh: true,
        onUpdate: (self) => { if (!narrowQuery.matches) hero.style.setProperty('--hero-out', clamp(self.progress).toFixed(4)); },
      },
    });
  }

  // Hero ушёл за экран — освобождаем разжатые кадры, вернулся — разжимаем окно заново.
  new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (!active) {
      for (const i of [...bitmaps.keys()]) drop(i);
    } else {
      lastKey = '';
      sync();
    }
  }).observe(track);

  // Файлы кадров: кадр 0 (фото) — сразу, остальные после загрузки страницы по 4 штуки параллельно с низким приоритетом, чтобы не мешать первому экрану.
  const load = async (i: number) => {
    try {
      const response = await fetch(urls[i], { priority: 'low' } as RequestInit);
      if (!response.ok) return;
      blobs[i] = await response.blob();
      const [lo, hi] = span();
      if (i >= lo && i <= hi) sync();
    } catch {
      /* кадр не загрузился — берём ближайший готовый */
    }
  };
  void load(0);
  const loadRest = async () => {
    let next = 1;
    const worker = async () => {
      while (next <= last) await load(next++);
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  };
  const start = () => void loadRest();
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

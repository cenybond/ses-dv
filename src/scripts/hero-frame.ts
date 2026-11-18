// Hero главной на GSAP ScrollTrigger.
// 1. Шапка: белая полоса перетекает в три плавающие плашки (логотип, меню, действия). Прогресс прокрутки 0…1 пишется в --header-p,
//    геометрию плашек в состоянии полосы измеряем здесь.
// 2. Hero «залипает» (CSS sticky в .hero-track) на время проигрывания кадров видео: камера уходит от здания под землю, к кабелям.
//    Кадры лежат в design/client-preview/hero/frames (scripts/build-hero-frames.py), кадр 0 — само фото 1 в 1.
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

/* ---------- Hero: поля, кадры, закрепление ---------- */
// Телефон и планшет (≤ 960 px, решение владельца 2026-11-19): вертикальное фото без кадров и закрепления — анимацию не запускаем.
const narrowQuery = window.matchMedia('(max-width: 960px)');
if (track && hero && card && canvas && !reducedMotion && !narrowQuery.matches) {
  const urls: string[] = JSON.parse(canvas.dataset.framesLg ?? '[]');
  const ctx = canvas.getContext('2d');
  const images: (HTMLImageElement | undefined)[] = new Array(urls.length);
  const last = urls.length - 1;

  // Доли пути прокрутки: поля уходят на первых OPEN, кадры идут до PLAY, дальше пауза на последнем кадре.
  const OPEN = 0.25;
  const PLAY = 0.94;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const easeOut = (t: number) => 1 - (1 - t) ** 3;

  const state = { p: 0 };
  let cw = 0;
  let ch = 0;
  let lastKey = '';

  const loadFrame = (i: number) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        images[i] = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = urls[i];
    });

  // Тот же «cover» по центру, что у <img class="hero__photo">: на старте canvas совпадает с фото пиксель в пиксель.
  const drawCover = (img: HTMLImageElement, alpha: number) => {
    if (!ctx) return;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };
  const nearestLoaded = (i: number) => {
    for (let j = Math.min(i, last); j >= 0; j--) if (images[j]) return j;
    return -1;
  };

  const render = () => {
    // Если окно стало узким уже после загрузки (поворот, эмуляция устройства), поля рамки не анимируем: на телефоне карточка всегда в рамке, без дёрганья.
    if (narrowQuery.matches) {
      hero.style.setProperty('--hero-k', '1');
      hero.style.setProperty('--hero-out', '0');
      return;
    }
    const p = state.p;
    hero.style.setProperty('--hero-k', (1 - easeOut(clamp(p / OPEN))).toFixed(4));
    if (!ctx || !images[0]) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(card.clientWidth * dpr));
    const h = Math.max(1, Math.round(card.clientHeight * dpr));
    const f = clamp(p / PLAY) * last;
    const key = `${w}x${h}|${f.toFixed(3)}|${images.filter(Boolean).length}`;
    if (key === lastKey) return;
    lastKey = key;
    if (w !== cw || h !== ch) {
      cw = canvas.width = w;
      ch = canvas.height = h;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cw, ch);
    // Между двумя соседними кадрами — перекрёстное смешение: прокрутка идёт плавно, а не шагами по 61 кадру.
    const i0 = Math.floor(f);
    const base = nearestLoaded(i0);
    if (base < 0) return;
    drawCover(images[base]!, 1);
    const next = images[i0 + 1];
    if (next && base === i0) drawCover(next, f - i0);
    ctx.globalAlpha = 1;
    card.classList.add('has-frames');
  };

  gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: render,
    // Десктоп: путь кадров заканчивается, когда верхний край блока .home-rest (он заходит на последний экран дорожки) касается низа экрана.
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: () => `+=${Math.max(1, track.offsetHeight - 2 * window.innerHeight)}`,
      scrub: 0.5,
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
  new ResizeObserver(() => {
    lastKey = '';
    render();
  }).observe(card);

  // Кадр 0 (фото) — сразу, остальные после загрузки страницы по 6 штук параллельно, чтобы не мешать первому экрану.
  void loadFrame(0).then(render);
  const loadRest = async () => {
    let next = 1;
    const worker = async () => {
      while (next <= last) {
        await loadFrame(next++);
        render();
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  };
  const start = () => void loadRest();
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

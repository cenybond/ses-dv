// Плавное появление разделов и текста по мере прокрутки на всех страницах (решение владельца 2026-11-19).
// Заголовки, абзацы, пункты списков, карточки и крупные блоки выезжают снизу и проявляются; элементы, попавшие в экран одновременно,
// идут каскадом. Что уже видно при загрузке (и всё, что осталось выше экрана при возврате на страницу), не прячется — вспышки нет.
// Без JS и при «уменьшении движения» ничего не скрывается. Hero, подвал, окна-шторки, закреплённый блок обращения и лента заказчиков
// не затрагиваются (у них своя анимация). После показа инлайн-стили снимаются, поэтому hover и раскладка работают как обычно.
import { gsap, ScrollTrigger, reducedMotion } from './smooth-scroll.ts';

const ITEMS = 'h1,h2,h3,h4,p,li,dl > div,figure,form,table,blockquote,.pg,.clients';
const SKIP = '.hero-track,dialog,.home-cta,.site-header,.site-footer,.mobile-bottom-bar,[data-no-reveal]';
const BLOCKS = '.pg,.clients,figure,form,table';

function init() {
  const main = document.querySelector<HTMLElement>('main');
  if (!main || reducedMotion) return;

  const candidates = Array.from(main.querySelectorAll<HTMLElement>(ITEMS)).filter((element) => !element.closest(SKIP));
  const set = new Set(candidates);
  // Вложенные элементы не анимируем отдельно: появляется внешний (пункт списка целиком, а не его абзац).
  const top = candidates.filter((element) => {
    for (let parent = element.parentElement; parent && parent !== main; parent = parent.parentElement) if (set.has(parent)) return false;
    return true;
  });

  const edge = window.innerHeight * 0.92;
  const items = top.filter((element) => {
    const box = element.getBoundingClientRect();
    return box.height > 0 && box.top > edge; // видимое сейчас и оставшееся выше экрана не трогаем
  });
  if (!items.length) return;

  const blocks = items.filter((element) => element.matches(BLOCKS));
  const texts = items.filter((element) => !element.matches(BLOCKS));
  // Пустой список GSAP считает ошибкой («target not found») — на страницах без блоков или без текста вызов пропускаем.
  if (texts.length) gsap.set(texts, { opacity: 0, y: 28 });
  if (blocks.length) gsap.set(blocks, { opacity: 0, y: 48 });

  ScrollTrigger.batch(items, {
    start: 'top 92%',
    once: true,
    interval: 0.12,
    batchMax: 6,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.09,
        overwrite: true,
        clearProps: 'opacity,transform',
      }),
  });

  // Шрифты и фото меняют высоту страницы — пересчитываем точки срабатывания.
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

// Знак в подвале (пять фигур): сначала поднимается и проявляется центральная «кровля», затем соседние фигуры, затем боковые — от центра к краям.
// Анимация один раз, когда знак доходит до нижнего края экрана (на коротких страницах — сразу после загрузки).
function initFooterMark() {
  const mark = document.querySelector<SVGElement>('.footer__mark');
  if (!mark || reducedMotion) return;
  const shapes = {
    core: mark.querySelectorAll('.footer__mark-core'),
    mid: mark.querySelectorAll('.footer__mark-mid'),
    side: mark.querySelectorAll('.footer__mark-side'),
  };
  const all = mark.querySelectorAll('path');
  gsap.set(all, { opacity: 0, y: 70 });
  const play = () => {
    const timeline = gsap.timeline({ defaults: { duration: 1, ease: 'power3.out' } });
    timeline
      .to(shapes.core, { opacity: 1, y: 0 }, 0)
      .to(shapes.mid, { opacity: 1, y: 0 }, 0.22)
      .to(shapes.side, { opacity: 1, y: 0 }, 0.44);
    timeline.eventCallback('onComplete', () => { gsap.set(all, { clearProps: 'opacity,transform' }); });
  };
  ScrollTrigger.create({ trigger: mark, start: 'top 98%', once: true, onEnter: play });
}

init();
initFooterMark();

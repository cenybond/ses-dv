// Окна на главной: «Подробный перечень услуг» (раздел «Наши услуги»), «Еще работы» (раздел «Проекты») и окно каждого проекта открываются шторкой на весь экран.
// Шторка выезжает снизу и уходит обратно (CSS-переход, класс `is-visible`); нативный <dialog>.showModal() даёт ловушку фокуса,
// инертный фон и Esc. Закрытие (крестик, Esc, клик по фону) идёт через анимацию. Кнопка-открывалка: `data-modal-open="<id окна>"`.
//
// Окно проекта открывается «морфингом» (решение владельца 2026-11-19): фото плитки (`[data-morph-source]` внутри кнопки) плавно становится большим
// фото окна (`[data-morph-target]`), остальное содержимое уходит, а текст справа появляется с задержкой. Основа — View Transitions API
// (document.startViewTransition, общий view-transition-name у обоих фото; анимации текста — в projects-gallery.css); без его поддержки то же делает GSAP Flip.
// Закрытие идёт тем же путём назад, если плитка ещё на экране. При «уменьшении движения» и если плитка вне экрана — обычная шторка.
import { lenis, gsap } from './smooth-scroll.ts';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const MORPH_NAME = 'project-photo';
const supportsViewTransitions = () => typeof document.startViewTransition === 'function';

// Плагин Flip нужен только браузерам без View Transitions: грузится по требованию; если не загрузился, окно открывается обычной шторкой.
const loadFlip = async () => {
  try {
    const { Flip } = await import('gsap/Flip');
    gsap.registerPlugin(Flip);
    return Flip;
  } catch {
    return null;
  }
};
if (!supportsViewTransitions()) void loadFlip();

const settle = (promise: Promise<unknown>, ms: number) => Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, ms))]);
const onScreen = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
};

function setup(dialog: HTMLDialogElement, openers: HTMLElement[]) {
  let opener: HTMLElement | null = null;
  let closing = false;
  const target = dialog.querySelector<HTMLElement>('[data-morph-target]');
  const info = dialog.querySelector<HTMLElement>('.project-modal__text');

  // Окно уже стоит на месте (без выезда снизу): так открывается морфинг.
  const showInstantly = () => {
    dialog.dataset.morph = '';
    dialog.showModal();
    lenis?.stop();
    dialog.classList.add('is-visible');
    dialog.querySelector<HTMLElement>('[data-slides]')?.scrollTo({ left: 0 });
    dialog.querySelector<HTMLElement>('.list-modal__scroll')?.scrollTo({ top: 0 });
  };

  const morphSource = (trigger: HTMLElement) => {
    const source = trigger.querySelector<HTMLElement>('[data-morph-source]');
    return !reduced.matches && target && source && onScreen(source) ? source : null;
  };

  const openMorph = async (trigger: HTMLElement, source: HTMLElement) => {
    opener = trigger;
    // Большое фото должно быть готово до начала перехода, иначе в снимке «после» окажется пустое место.
    const image = target?.querySelector<HTMLImageElement>('img');
    if (image) { image.loading = 'eager'; await settle(image.decode().catch(() => undefined), 500); }
    if (dialog.open) return;
    if (supportsViewTransitions()) {
      source.style.viewTransitionName = MORPH_NAME;
      const transition = document.startViewTransition(() => {
        source.style.viewTransitionName = '';
        target!.style.viewTransitionName = MORPH_NAME;
        showInstantly();
      });
      transition.finished.catch(() => undefined).finally(() => { target!.style.viewTransitionName = ''; });
      return;
    }
    const Flip = await loadFlip();
    if (dialog.open) return;
    const from = source.getBoundingClientRect();
    showInstantly();
    if (!Flip) return; // без плагина просто открытое окно
    gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' });
    if (info) gsap.fromTo(info, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.35, ease: 'power3.out', clearProps: 'opacity,transform' });
    Flip.fit(target!, from as unknown as Element, { scale: true });
    gsap.to(target!, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.6, ease: 'power3.inOut', clearProps: 'transform' });
  };

  const open = (trigger: HTMLElement) => {
    if (dialog.open) return;
    const source = morphSource(trigger);
    if (source) { void openMorph(trigger, source); return; }
    opener = trigger;
    const id = trigger.dataset.service ?? '';
    dialog.querySelectorAll('[data-service]').forEach((item) => item.toggleAttribute('data-active', id !== '' && item.getAttribute('data-service') === id));
    dialog.showModal();
    lenis?.stop();
    // Прокручиваем только список внутри окна: scrollIntoView мог бы сдвинуть и саму страницу.
    const scroller = dialog.querySelector<HTMLElement>('.list-modal__scroll');
    const active = dialog.querySelector<HTMLElement>('[data-active]');
    if (scroller && active) scroller.scrollTop = Math.max(0, active.offsetTop - scroller.clientHeight / 2);
    // Два кадра: сначала шторка стоит внизу, потом выезжает.
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-visible')));
  };

  // Назад морфингом: только если окно открывалось морфингом, плитка на экране и показан первый снимок (тот, что вырос из плитки).
  const closeMorph = (): boolean => {
    if (!dialog.hasAttribute('data-morph') || reduced.matches || !target || !opener) return false;
    const source = opener.querySelector<HTMLElement>('[data-morph-source]');
    const slides = dialog.querySelector<HTMLElement>('[data-slides]');
    if (!source || !onScreen(source) || (slides && slides.scrollLeft > 4)) return false;
    closing = true;
    const card = opener;
    card.classList.add('is-morphing');
    const reveal = () => card.classList.remove('is-morphing');
    if (supportsViewTransitions()) {
      target.style.viewTransitionName = MORPH_NAME;
      const transition = document.startViewTransition(() => {
        target.style.viewTransitionName = '';
        dialog.close();
        source.style.viewTransitionName = MORPH_NAME;
      });
      transition.finished.catch(() => undefined).finally(() => { source.style.viewTransitionName = ''; closing = false; requestAnimationFrame(reveal); });
    } else {
      void loadFlip().then((Flip) => {
        if (!Flip) { dialog.close(); closing = false; reveal(); return; }
        if (info) gsap.to(info, { opacity: 0, duration: 0.2 });
        gsap.to(dialog, { opacity: 0, duration: 0.3, delay: 0.25, ease: 'power1.in' });
        Flip.fit(target, source, { scale: true, duration: 0.5, ease: 'power3.inOut', onComplete: () => {
          dialog.close();
          gsap.set([dialog, target, info], { clearProps: 'all' });
          closing = false;
          reveal();
        } });
      });
    }
    return true;
  };

  const close = () => {
    if (!dialog.open || closing) return;
    if (reduced.matches) { dialog.close(); return; }
    if (closeMorph()) return;
    closing = true;
    let done = false;
    const onEnd = (event: TransitionEvent) => { if (event.target === dialog) finish(); };
    const finish = () => {
      if (done) return;
      done = true;
      closing = false;
      dialog.removeEventListener('transitionend', onEnd);
      dialog.close();
    };
    dialog.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, 450); // страховка, если переход не сработал
    dialog.classList.remove('is-visible');
  };

  openers.forEach((trigger) => trigger.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // «открыть в новой вкладке» остаётся обычной ссылкой
    event.preventDefault();
    open(trigger);
  }));
  // Открытие без кнопки с `data-modal-open`: панель галереи проектов шлёт окну событие `modal:open` (scripts/projects-gallery.ts).
  dialog.addEventListener('modal:open', (event) => {
    const trigger = (event as CustomEvent<{ trigger?: HTMLElement }>).detail?.trigger;
    if (trigger) open(trigger);
  });
  dialog.querySelector('[data-modal-close]')?.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); }); // Esc
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); }); // затемнённый фон
  // Переход по ссылке из списка (страница проекта): окно закрывается вместе с уходом со страницы.
  dialog.addEventListener('close', () => {
    dialog.classList.remove('is-visible');
    delete dialog.dataset.morph;
    if (!document.querySelector('dialog[open]')) lenis?.start(); // окно проекта открывается поверх списка: страница остаётся заблокированной
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  // Возврат по истории из bfcache не должен показывать открытое окно.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && dialog.open) dialog.close();
  });
}

document.querySelectorAll<HTMLDialogElement>('dialog.list-modal').forEach((dialog) => {
  if (typeof dialog.showModal !== 'function') return;
  const openers = Array.from(document.querySelectorAll<HTMLElement>(`[data-modal-open="${dialog.id}"]`));
  if (openers.length) setup(dialog, openers);
});

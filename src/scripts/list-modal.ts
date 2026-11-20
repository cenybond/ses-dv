// Окна на главной: «Подробный перечень услуг» (раздел «Наши услуги»), «Еще работы» (раздел «Проекты») и окно каждого проекта открываются шторкой на весь экран.
// Шторка выезжает снизу и уходит обратно (CSS-переход, класс `is-visible`); нативный <dialog>.showModal() даёт ловушку фокуса,
// инертный фон и Esc. Закрытие (крестик, Esc, клик по фону) идёт через анимацию. Кнопка-открывалка: `data-modal-open="<id окна>"`.
//
// Окно проекта открывается «морфингом» (решение владельца 2026-11-19): фото плитки (`[data-morph-source]` внутри кнопки) плавно становится большим
// фото окна (`[data-morph-target]`), остальное содержимое уходит, а название и текст появляются с задержкой. Основа — View Transitions API
// (document.startViewTransition, общий view-transition-name у обоих фото; анимации текста — в projects-gallery.css); без его поддержки то же делает GSAP Flip.
// Закрытие идёт тем же путём назад, если плитка ещё на экране. При «уменьшении движения» и если плитка вне экрана — обычная шторка.
import { lenis, gsap } from './smooth-scroll.ts';
import { pushModal, closeViaHistory, forgetModal } from './modal-history.ts';

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
  // Адрес окна в строке браузера (PROD-22): у окна проекта — /projects/<проект>, с номером снимка, если ссылку открыли сразу на нём (`dataset.start`).
  const modalUrl = () => {
    const base = dialog.dataset.path;
    const start = Number(dialog.dataset.start ?? 0);
    return base ? (start > 0 ? `${base}?photo=${start + 1}` : base) : undefined;
  };
  const info = Array.from(dialog.querySelectorAll<HTMLElement>('.project-modal__title, .project-modal__text'));

  // Окно уже стоит на месте (без выезда снизу): так открывается морфинг.
  const showInstantly = () => {
    dialog.dataset.morph = '';
    dialog.showModal();
    pushModal(dialog, close, modalUrl());
    lenis?.stop();
    dialog.classList.add('is-visible');
    dialog.dispatchEvent(new CustomEvent('slider:reset')); // снимки (project-slider.ts): снова первый
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
    gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out', clearProps: 'opacity' });
    if (info.length) gsap.fromTo(info, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.25, ease: 'power3.out', clearProps: 'opacity,transform' });
    Flip.fit(target!, from as unknown as Element, { scale: true });
    gsap.to(target!, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.42, ease: 'power3.inOut', clearProps: 'transform' });
  };

  const open = (trigger: HTMLElement) => {
    if (dialog.open) return;
    const source = morphSource(trigger);
    if (source) { void openMorph(trigger, source); return; }
    opener = trigger;
    const id = trigger.dataset.service ?? '';
    dialog.querySelectorAll('[data-service]').forEach((item) => item.toggleAttribute('data-active', id !== '' && item.getAttribute('data-service') === id));
    dialog.showModal();
    pushModal(dialog, close, modalUrl());
    lenis?.stop();
    dialog.dispatchEvent(new CustomEvent('slider:reset')); // снимки (project-slider.ts): первый или тот, что указан в ссылке
    // Прокручиваем только список внутри окна: scrollIntoView мог бы сдвинуть и саму страницу.
    const scroller = dialog.querySelector<HTMLElement>('.list-modal__scroll');
    const active = dialog.querySelector<HTMLElement>('[data-active]');
    if (scroller && active) scroller.scrollTop = Math.max(0, active.offsetTop - scroller.clientHeight / 2);
    // Два кадра: сначала шторка стоит внизу, потом выезжает.
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-visible')));
  };

  // Назад морфингом: только если окно открывалось морфингом, плитка и рамка с фото на экране. Какой бы снимок ни был показан (решение владельца 2026-11-20),
  // рамка с ним возвращается в плитку так же, как первый: форма и размер плавно переходят, снимок растворяется в фото плитки.
  const closeMorph = (): boolean => {
    if (!dialog.hasAttribute('data-morph') || reduced.matches || !target || !opener) return false;
    const source = opener.querySelector<HTMLElement>('[data-morph-source]');
    if (!source || !onScreen(source) || !onScreen(target)) return false;
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
        if (info.length) gsap.to(info, { opacity: 0, duration: 0.15 });
        gsap.to(dialog, { opacity: 0, duration: 0.2, delay: 0.18, ease: 'power1.in' });
        Flip.fit(target, source, { scale: true, duration: 0.36, ease: 'power3.inOut', onComplete: () => {
          dialog.close();
          gsap.set([dialog, target, ...info], { clearProps: 'all' });
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
  // Крестик, Esc и фон закрывают окно через «Назад» браузера (modal-history.ts): записи истории не копятся, а системное «Назад» и смахивание закрывают окно, а не сайт.
  const dismiss = () => {
    if (!dialog.open || closing) return;
    if (!closeViaHistory(dialog)) close();
  };
  dialog.querySelector('[data-modal-close]')?.addEventListener('click', dismiss);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); dismiss(); }); // Esc
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dismiss(); }); // затемнённый фон
  dialog.addEventListener('close', () => {
    forgetModal(dialog);
    delete dialog.dataset.start;
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

// Первое фото окна проекта в разметке ленивое: закрытые окна не качают снимки при загрузке страницы (14 окон — около 3 МБ на телефоне).
// Чтобы морфинг не ждал сеть, фото подгружается заранее: окон шести панелей — когда блок «Проекты» подходит к экрану,
// окон плиток «Еще работы» — когда это окно открылось, любого окна — при наведении, касании или фокусе на его кнопке.
const PROJECT_TRIGGER = '[data-project-modal], [data-modal-open^="project-modal-"]';
const warmProject = (trigger: Element | null) => {
  if (!(trigger instanceof HTMLElement)) return;
  const id = trigger.dataset.projectModal ?? trigger.dataset.modalOpen;
  const image = id ? document.getElementById(id)?.querySelector<HTMLImageElement>('[data-morph-target] img') : null;
  if (image?.loading === 'lazy') image.loading = 'eager';
};
const warmAll = (root: ParentNode) => root.querySelectorAll(PROJECT_TRIGGER).forEach(warmProject);
const onIntent = (event: Event) => warmProject(event.target instanceof Element ? event.target.closest(PROJECT_TRIGGER) : null);
['pointerover', 'touchstart', 'focusin'].forEach((type) => document.addEventListener(type, onIntent, { passive: true }));

const gallery = document.querySelector<HTMLElement>('[data-pg]');
if (gallery) {
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    warmAll(gallery);
  }, { rootMargin: '100% 0px' }).observe(gallery);
}
const projectsList = document.getElementById('list-modal-projects');
if (projectsList) {
  const watch = new MutationObserver(() => {
    if (!projectsList.hasAttribute('open')) return;
    watch.disconnect();
    warmAll(projectsList);
  });
  watch.observe(projectsList, { attributes: true, attributeFilter: ['open'] });
}

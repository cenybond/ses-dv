// Меню-шторка (≤ 960 px): прогрессивное улучшение поверх якоря `#site-nav`. Нативный <dialog>.showModal() даёт ловушку фокуса,
// инертный фон и закрытие по Esc; здесь — открытие/закрытие, возврат фокуса, закрытие по клику на фон и при расширении окна.
// Инициализация идемпотентна: повторный вызов не навешивает обработчики второй раз.
import { pushModal, closeViaHistory, forgetModal, hasModalEntry } from './modal-history.ts';

const MENU_BREAKPOINT = '(max-width: 960px)';
const initialised = new WeakSet<HTMLDialogElement>();

export function afterMobileMenuCloses(onClose: () => void): void {
  const menu = document.querySelector<HTMLDialogElement>('#menu[open]');
  if (!menu) {
    onClose();
    return;
  }
  // Запускаем прокрутку после закрытия шторки и снятия блокировки Lenis.
  menu.addEventListener('close', () => requestAnimationFrame(onClose), { once: true });
  if (!closeViaHistory(menu)) menu.close();
}

export function initMobileMenu(): void {
  const menu = document.querySelector<HTMLDialogElement>('#menu');
  const openers = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-open-menu]'));
  if (!menu || typeof menu.showModal !== 'function' || initialised.has(menu)) return;
  initialised.add(menu);

  let opener: HTMLElement | null = null;

  const open = (from: HTMLElement) => {
    if (menu.open) return;
    opener = from;
    menu.showModal();
    pushModal(menu, () => close()); // смахивание и системное «Назад» закрывают шторку, а не уводят с сайта (modal-history.ts)
    openers.forEach((o) => o.setAttribute('aria-expanded', 'true'));
  };
  // Закрытие плавное: шторка уезжает вниз (класс is-closing), затем диалог закрывается. Без анимации — при «уменьшении движения»,
  // при расширении окна и возврате из bfcache.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const box = menu.querySelector('.modal__box--menu');
  let closing = false;
  let timer = 0;
  const finish = () => {
    if (!closing) return;
    closing = false;
    window.clearTimeout(timer);
    menu.classList.remove('is-closing');
    menu.close();
  };
  // Конец анимации ухода слушаем один раз на всю жизнь страницы (раньше слушатель добавлялся при каждом закрытии и оставался,
  // если первым срабатывал запасной таймер). Срабатывает только во время закрытия: анимация открытия finish не вызывает.
  box?.addEventListener('animationend', finish);
  const close = (animated = true) => {
    if (!menu.open || closing) return;
    if (!animated || reduced.matches || !box) {
      menu.close();
      return;
    }
    closing = true;
    menu.classList.add('is-closing');
    timer = window.setTimeout(finish, 500); // запасной путь, если animationend не придёт
  };

  // Ссылка-якорь становится кнопкой: роль, раскрытие, Space как у кнопки.
  openers.forEach((a) => {
    a.setAttribute('role', 'button');
    a.setAttribute('aria-haspopup', 'dialog');
    a.setAttribute('aria-expanded', 'false');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(a);
    });
    a.addEventListener('keydown', (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        open(a);
      }
    });
  });

  // Крестик, Esc и фон закрывают шторку через «Назад» браузера, записи истории не копятся.
  const dismiss = () => {
    if (!menu.open || closing) return;
    if (!closeViaHistory(menu)) close();
  };
  menu.querySelector('[data-close-menu]')?.addEventListener('click', dismiss);
  // Esc: вместо мгновенного закрытия — то же плавное.
  menu.addEventListener('cancel', (e) => {
    e.preventDefault();
    dismiss();
  });
  // Клик по затемнённому фону (сам <dialog>, а не коробка внутри) закрывает шторку. Один обработчик клика на шторку (так проверяет check-browser).
  menu.addEventListener('click', (e) => {
    if (e.target === menu) { dismiss(); return; }
    // Пункт ведёт на другую страницу (главная сама прокручивает к разделам и отменяет переход): запись шторки в истории заменяется страницей,
    // иначе «Назад» с той страницы вернул бы на главную с уже закрытой шторкой и потребовал бы второго нажатия.
    const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || (link.target && link.target !== '_self')) return;
    if (!hasModalEntry(menu) || !/^https?:$/.test(link.protocol) || link.origin !== location.origin) return;
    e.preventDefault();
    location.replace(link.href);
  });
  menu.addEventListener('close', () => {
    forgetModal(menu);
    openers.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    const target = opener && document.contains(opener) && opener.offsetParent !== null ? opener : null;
    opener = null;
    if (!target) return;
    target.focus({ preventScroll: true });
    // Браузер может вернуть фокус «на прежний элемент» после нашего обработчика (прежним был <body>, если шторку открыли без фокуса).
    requestAnimationFrame(() => {
      if (document.activeElement !== target && !menu.open) target.focus({ preventScroll: true });
    });
  });

  // Окно расширилось до десктопа: шторка не нужна, а кнопка исчезла бы из дерева доступности вместе с фокусом.
  const wide = window.matchMedia(MENU_BREAKPOINT);
  wide.addEventListener('change', (e) => {
    if (!e.matches) close(false);
  });
  // Возврат по истории из bfcache не должен показывать открытую шторку.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) close(false);
  });
}

// Меню-шторка (≤ 960 px): прогрессивное улучшение поверх якоря `#site-nav`. Нативный <dialog>.showModal() даёт ловушку фокуса,
// инертный фон и закрытие по Esc; здесь — открытие/закрытие, возврат фокуса, закрытие по клику на фон и при расширении окна.
// Инициализация идемпотентна: повторный вызов не навешивает обработчики второй раз.
const MENU_BREAKPOINT = '(max-width: 960px)';
const initialised = new WeakSet<HTMLDialogElement>();

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
    openers.forEach((o) => o.setAttribute('aria-expanded', 'true'));
  };
  // Закрытие плавное: шторка уезжает вниз (класс is-closing), затем диалог закрывается. Без анимации — при «уменьшении движения»,
  // при расширении окна и возврате из bfcache.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let closing = false;
  const close = (animated = true) => {
    if (!menu.open || closing) return;
    const box = menu.querySelector('.modal__box--menu');
    if (!animated || reduced.matches || !box) {
      menu.close();
      return;
    }
    closing = true;
    menu.classList.add('is-closing');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      menu.classList.remove('is-closing');
      closing = false;
      menu.close();
    };
    box.addEventListener('animationend', finish, { once: true });
    window.setTimeout(finish, 500);
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

  menu.querySelector('[data-close-menu]')?.addEventListener('click', () => close());
  // Esc: вместо мгновенного закрытия — то же плавное.
  menu.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // Клик по затемнённому фону (сам <dialog>, а не коробка внутри) закрывает шторку.
  menu.addEventListener('click', (e) => {
    if (e.target === menu) close();
  });
  menu.addEventListener('close', () => {
    openers.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    const target = opener && document.contains(opener) && opener.offsetParent !== null ? opener : null;
    opener = null;
    if (!target) return;
    target.focus();
    // Браузер может вернуть фокус «на прежний элемент» после нашего обработчика (прежним был <body>, если шторку открыли без фокуса).
    requestAnimationFrame(() => {
      if (document.activeElement !== target && !menu.open) target.focus();
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

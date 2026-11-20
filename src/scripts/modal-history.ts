// Окна и кнопка «Назад» (решение владельца 2026-11-20, DECISIONS.md PROD-20). На телефоне посетитель закрывает окно («Еще работы», проект, перечень услуг)
// смахиванием вправо от края экрана или системной кнопкой «Назад». Без этого модуля такой жест уводил бы с сайта целиком и мы теряли бы клиента.
// Каждое открытое окно добавляет запись в историю браузера (адрес не меняется, в записи только глубина `mh`): «Назад» закрывает верхнее окно, а не страницу.
// Окно проекта поверх списка «Еще работы» — вторая запись: первое «Назад» закрывает проект, второе — список.
// Закрытие крестиком, Esc и фоном тоже идёт через `history.back()`, чтобы записи не копились; если окно закрыли кодом (кнопка «Заказать звонок» в окне проекта,
// возврат из bfcache), лишние записи убирает `history.go(-n)`. Пока окно открыто, браузер не восстанавливает прокрутку при переходах по этим записям
// (`scrollRestoration = 'manual'`): иначе страница прыгала бы назад.
type Entry = { dialog: HTMLDialogElement; dismiss: () => void };

const stack: Entry[] = [];
const original = history.scrollRestoration;
let depth = 0; // сколько записей истории сейчас принадлежит окнам
let ignore = 0; // 1, пока идёт переход назад, который начали мы сами (запись закрытого окна)
let backing = false; // уже идёт history.back() от крестика/Esc

// Перезагрузка с открытым окном: запись осталась в истории, а окна уже нет.
try { if (history.state && typeof history.state === 'object' && 'mh' in history.state) history.replaceState(null, ''); } catch { /* история недоступна */ }

const restore = () => { if (!stack.length && ignore === 0) history.scrollRestoration = original; };

// Лишние записи (окно закрыли кодом или ушли вперёд в запись закрытого окна) убираем одним переходом назад.
const reconcile = () => {
  if (ignore > 0) return;
  const extra = depth - stack.length;
  if (extra > 0) { ignore = 1; history.go(-extra); } else restore();
};

window.addEventListener('popstate', () => {
  backing = false;
  const state = history.state as { mh?: number } | null;
  depth = state?.mh ?? 0;
  if (ignore > 0) { ignore = 0; reconcile(); return; }
  while (stack.length > depth) stack.pop()!.dismiss(); // «Назад»: закрываем верхнее окно (с анимацией, как крестик)
  reconcile();
});

let forced = false;
/** Ссылка на окно открыта сразу при загрузке страницы (deeplinks.ts): посетитель ещё ничего не нажимал, но запись окна всё равно нужна, чтобы адрес показывал окно, а «Назад» его закрывало. */
export function forceNextPush(): void { forced = true; }

/** Окно открылось: добавляем запись в историю. `dismiss` — закрытие окна с анимацией (его вызовет «Назад»). `url` — адрес окна в строке браузера (data-path окна). */
export function pushModal(dialog: HTMLDialogElement, dismiss: () => void, url?: string): void {
  if (stack.some((entry) => entry.dialog === dialog)) return;
  const force = forced;
  forced = false;
  // Chrome пропускает при «Назад» записи, добавленные страницей, с которой посетитель ещё ничего не делал: тогда «Назад» увело бы со страницы.
  // Живой посетитель всегда нажимает кнопку перед открытием окна; без такого нажатия (скрипт, автотест) окно работает без записи истории.
  if (!force && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    if (!stack.length) history.scrollRestoration = 'manual';
    stack.push({ dialog, dismiss });
    history.pushState({ mh: stack.length }, '', url);
    depth = stack.length;
  } catch {
    stack.pop(); // история недоступна: окно просто работает без неё
  }
}

/** Закрытие по крестику, Esc или фону: через «Назад». Вернёт false, если окну записи нет (тогда окно закрывает вызывающий сам). */
export function closeViaHistory(dialog: HTMLDialogElement): boolean {
  const top = stack[stack.length - 1];
  const state = history.state as { mh?: number } | null;
  if (!top || top.dialog !== dialog || depth !== stack.length || state?.mh !== stack.length) return false;
  if (backing) return true; // повторное нажатие, пока переход идёт, не должно увести со страницы
  backing = true;
  history.back();
  window.setTimeout(() => { // страховка: переход не состоялся — закрываем сами
    if (!backing) return;
    backing = false;
    if (dialog.open) top.dismiss();
  }, 800);
  return true;
}

/** Есть ли у окна своя запись в истории (меню: пункт-ссылка на другую страницу заменяет эту запись, а не добавляет следующую). */
export function hasModalEntry(dialog: HTMLDialogElement): boolean {
  return stack.some((entry) => entry.dialog === dialog);
}

/** Окно закрылось (событие `close`): если запись осталась, убираем её. */
export function forgetModal(dialog: HTMLDialogElement): void {
  const index = stack.findIndex((entry) => entry.dialog === dialog);
  if (index < 0) return;
  stack.splice(index, 1);
  queueMicrotask(reconcile);
}

// Адреса главной (решение владельца 2026-11-20, DECISIONS.md PROD-22). Сайт одностраничный, но у раздела, окна и снимка проекта есть свой адрес «через слэш»:
//   /services, /services/all (перечень услуг), /projects, /projects/all («Еще работы»), /projects/<проект>, /projects/<проект>?photo=3.
// 1) Пока посетитель листает страницу, адрес в строке сам становится адресом раздела (`history.replaceState`: записи истории не плодятся), его можно скопировать и отправить.
// 2) Окна проекта и списков при открытии добавляют запись с адресом окна (modal-history.ts), снимки меняют только `?photo=` в этой записи (project-slider.ts шлёт `slider:change`).
// 3) Открытая ссылка на раздел плавно прокручивает страницу от начала к разделу, ссылка на окно — прокручивает к «Проектам» и открывает окно (на нужном снимке).
// Адреса — настоящие страницы (копии главной, src/pages/services, src/pages/projects): работают без JS и на любом хостинге, без правил перенаправления.
import { lenis, reducedMotion } from './smooth-scroll.ts';
import { forceNextPush } from './modal-history.ts';
import { toLocal, toPublic } from './base-path.ts';

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path) || '/';
/** Главная или её копия (адрес раздела, списка или проекта): на них работают прокрутка по разделам, подчёркивание пункта меню и открытие окон. */
export const isHomePath = (path = location.pathname) => {
  const p = normalize(path);
  return p === '/' || p === '/services' || p.startsWith('/services/') || p === '/projects' || p.startsWith('/projects/');
};

const sectionOf = (id: string) => () => document.getElementById(id)?.closest('section') ?? null;
const sections: [path: string, find: () => HTMLElement | null][] = [
  ['/services', sectionOf('home-services')],
  ['/projects', sectionOf('home-projects')],
  ['/', () => document.getElementById('request')], // блок обращения внизу: адрес снова главная
];
let booting = true; // пока идёт первичная прокрутка к разделу, адрес не трогаем
const finishBoot = () => { booting = false; document.documentElement.dataset.deeplink = 'ready'; }; // метка нужна автотесту: прокрутка по ссылке закончена

const currentSectionPath = () => {
  const probe = window.innerHeight * 0.4;
  let path = '/';
  for (const [sectionPath, find] of sections) if ((find()?.getBoundingClientRect().top ?? Infinity) <= probe) path = sectionPath;
  return path;
};
const isModalPath = (path: string) => /^\/(services|projects)\/.+/.test(normalize(path));

if (isHomePath()) {
  // 1) Адрес следует за прокруткой: после остановки (без дребезга по пути) заменяем адрес записи на адрес раздела.
  let timer = 0;
  const syncPath = () => {
    if (booting || document.querySelector('dialog[open]')) return;
    const path = currentSectionPath();
    if (normalize(toLocal(location.pathname)) !== path || location.search || location.hash) history.replaceState(history.state, '', toPublic(path));
  };
  window.addEventListener('scroll', () => { window.clearTimeout(timer); timer = window.setTimeout(syncPath, 140); }, { passive: true });

  // 2) Снимок проекта — в адресе окна; закрытое кодом окно возвращает адрес раздела.
  window.addEventListener('slider:change', (event) => {
    const dialog = (event.target as Element | null)?.closest('dialog');
    const index = (event as CustomEvent<{ index?: number }>).detail?.index ?? 0;
    if (!dialog?.open || !dialog.dataset.path) return;
    history.replaceState(history.state, '', toPublic(dialog.dataset.path) + (index > 0 ? `?photo=${index + 1}` : ''));
  });
  document.addEventListener('close', () => {
    window.setTimeout(() => {
      if (document.querySelector('dialog[open]') || !isModalPath(location.pathname)) return;
      history.replaceState(history.state, '', toPublic(currentSectionPath())); // окно закрыли, а записи истории под ним не было
    }, 120);
  }, true);

  // 3) Открытие по ссылке.
  const scrollToSection = (section: HTMLElement | null, done: () => void) => {
    if (!section || window.scrollY > 100) { done(); return; } // браузер уже вернул прежнюю прокрутку (обновление страницы, «Назад»): не трогаем
    const offset = -(document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) - 12;
    if (lenis && !reducedMotion) lenis.scrollTo(section, { offset, duration: 1.7, force: true, onComplete: done });
    else { window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY + offset }); done(); }
  };

  const openDialog = (id: string, photo = 0) => {
    const dialog = document.getElementById(id);
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
    if (photo > 0) dialog.dataset.start = String(photo);
    forceNextPush();
    dialog.dispatchEvent(new CustomEvent('modal:open', { detail: { trigger: document.createElement('span') } })); // без плитки: окно выезжает шторкой, а не морфингом
  };

  const boot = () => {
    const rest = normalize(toLocal(location.pathname)).split('/').filter(Boolean);
    const base = rest[0] === 'services' ? '/services' : rest[0] === 'projects' ? '/projects' : '/';
    const section = base === '/services' ? sectionOf('home-services')() : base === '/projects' ? sectionOf('home-projects')() : null;
    if (!section) { finishBoot(); return; }
    const photo = Number(new URLSearchParams(location.search).get('photo')) || 1;
    const name = rest[1] ? decodeURIComponent(rest[1]) : '';
    const byPath = [...document.querySelectorAll<HTMLDialogElement>('dialog[data-path]')].find((dialog) => dialog.dataset.path === `${base}/${name}`);
    const target = byPath?.id ?? null;
    // Запись под окном — адрес раздела: «Назад» и крестик возвращают на него, а не уводят с сайта.
    if (target) history.replaceState(null, '', toPublic(base));
    scrollToSection(section, () => {
      finishBoot();
      if (target) openDialog(target, photo - 1);
    });
  };

  if (document.readyState === 'complete') window.setTimeout(boot, 300);
  else window.addEventListener('load', () => window.setTimeout(boot, 300), { once: true });
} else {
  finishBoot();
}

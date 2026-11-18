// Маршруты демо (SPEC-DEMO §5). Единственный источник путей для шапки, меню, подвала, нижней панели и страниц.
// `built: false` — страницы нет в dist; scripts/check-dist.mjs допускает ссылки на неё и печатает список ожидающих,
// scripts/check-links.mjs не допускает никаких ссылок на несуществующие страницы. С DEMO-04 есть все маршруты:
// содержимое страниц — заготовки, наполнение в DEMO-06…12. Подписи пунктов — data/ui.ts.
import { ui } from './ui.ts';

export type Route = { href: string; label: string; built: boolean };

export const routes = {
  home: '/',
  services: '/#home-services', // отдельной страницы услуг нет (решение владельца 2026-11-18): пункт ведёт к разделу «Наши услуги» на главной
  projects: '/#home-projects', // отдельной страницы каталога нет (решение владельца 2026-11-18): пункт ведёт к разделу «Проекты» на главной; полный перечень — окно по плитке «Еще работы»
  about: '/about',
  contacts: '/contacts',
  privacy: '/privacy',
  vacancies: '/vacancies',
} as const;

export const mainNav: Route[] = [
  { href: routes.about, label: ui.nav.about, built: true }, // порядок пунктов — решение владельца 2026-11-18: Главная, О нас, Услуги, Проекты, Контакты
  { href: routes.services, label: ui.nav.services, built: true },
  { href: routes.projects, label: ui.nav.projects, built: true },
  { href: routes.contacts, label: ui.nav.contacts, built: true }, // заготовка; DEMO-11
];

/** Вакансии компании на hh.ru (решение владельца 2026-11-18): пункт «Вакансии» в подвале ведёт на этот адрес в новой вкладке. Единственная разрешённая внешняя ссылка кроме tel:, mailto: и wa.me; внутренняя страница /vacancies остаётся. */
export const vacanciesExternalUrl = 'https://blagoveschensk.hh.ru/employer/9992331?hhtmFrom=vacancy&tab=VACANCIES';

export const privacyRoute: Route = { href: routes.privacy, label: ui.nav.privacy, built: true };

export const pendingRoutes = [...mainNav, privacyRoute].filter((r) => !r.built).map((r) => r.href);

/** Путь без завершающего слэша: `/about/` и `/about` — один маршрут (dev и build отдают разные формы). */
export const normalizePath = (pathname: string): string => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname) || '/';

/** Состояние пункта навигации для `aria-current`: `page` — это сама страница, `true` — страница внутри раздела. */
export const currentState = (href: string, pathname: string): 'page' | 'true' | undefined => {
  const path = normalizePath(pathname);
  if (path === href) return 'page';
  if (href !== routes.home && path.startsWith(`${href}/`)) return 'true';
  return undefined;
};

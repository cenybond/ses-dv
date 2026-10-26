// Маршруты демо (SPEC-DEMO §5). Единственный источник путей для шапки, меню, подвала, нижней панели и страниц.
// `built: false` — страницы нет в dist; scripts/check-dist.mjs допускает ссылки на неё и печатает список ожидающих,
// scripts/check-links.mjs не допускает никаких ссылок на несуществующие страницы. С DEMO-04 есть все маршруты:
// содержимое страниц — заготовки, наполнение в DEMO-06…12. Подписи пунктов — data/ui.ts.
import { ui } from './ui.ts';

export type Route = { href: string; label: string; built: boolean };

export const routes = {
  home: '/',
  services: '/services',
  projects: '/projects',
  about: '/about',
  contacts: '/contacts',
  privacy: '/privacy',
  vacancies: '/vacancies',
} as const;

/** Маршрут страницы проекта: только для проектов с `hasPage` (data/source/projects.ts). */
export const projectRoute = (slug: string) => `${routes.projects}/${slug}`;

export const mainNav: Route[] = [
  { href: routes.services, label: ui.nav.services, built: true }, // заготовка; наполнение DEMO-07
  { href: routes.projects, label: ui.nav.projects, built: true }, // заготовка; DEMO-08
  { href: routes.about, label: ui.nav.about, built: true }, // заготовка; DEMO-10
  { href: routes.contacts, label: ui.nav.contacts, built: true }, // заготовка; DEMO-11
];

export const privacyRoute: Route = { href: routes.privacy, label: ui.nav.privacy, built: true };

export const pendingRoutes = [...mainNav, privacyRoute].filter((r) => !r.built).map((r) => r.href);

/** Путь без завершающего слэша: `/services/` и `/services` — один маршрут (dev и build отдают разные формы). */
export const normalizePath = (pathname: string): string => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname) || '/';

/** Состояние пункта навигации для `aria-current`: `page` — это сама страница, `true` — страница внутри раздела (`/projects/tlt` в «Проектах»). */
export const currentState = (href: string, pathname: string): 'page' | 'true' | undefined => {
  const path = normalizePath(pathname);
  if (path === href) return 'page';
  if (href !== routes.home && path.startsWith(`${href}/`)) return 'true';
  return undefined;
};

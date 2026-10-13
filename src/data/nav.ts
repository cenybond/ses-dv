// Маршруты демо (SPEC-DEMO §5). `built: false` — страница ещё не реализована своей фазой PLAN-DEMO;
// scripts/check-dist.mjs допускает внутренние ссылки только на готовые страницы и печатает список ожидающих.
// Подписи пунктов — data/ui.ts.
import { ui } from './ui.ts';

export type Route = { href: string; label: string; built: boolean };

export const routes = {
  home: '/',
  services: '/services',
  projects: '/projects',
  about: '/about',
  contacts: '/contacts',
  privacy: '/privacy',
} as const;

/** Маршрут страницы проекта: только для проектов с `hasPage` (data/source/projects.ts). */
export const projectRoute = (slug: string) => `${routes.projects}/${slug}`;

export const mainNav: Route[] = [
  { href: routes.services, label: ui.nav.services, built: false }, // DEMO-07
  { href: routes.projects, label: ui.nav.projects, built: false }, // DEMO-08
  { href: routes.about, label: ui.nav.about, built: false }, // DEMO-10
  { href: routes.contacts, label: ui.nav.contacts, built: false }, // DEMO-11
];

export const privacyRoute: Route = { href: routes.privacy, label: ui.nav.privacy, built: false }; // DEMO-12

export const pendingRoutes = [...mainNav, privacyRoute].filter((r) => !r.built).map((r) => r.href);

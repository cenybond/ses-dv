// Маршруты демо (SPEC-DEMO §5). `built: false` — страница ещё не реализована своей фазой PLAN-DEMO;
// scripts/check-dist.mjs допускает внутренние ссылки только на готовые страницы и печатает список ожидающих.
export type Route = { href: string; label: string; built: boolean };

export const mainNav: Route[] = [
  { href: '/services', label: 'Услуги', built: false }, // DEMO-07
  { href: '/projects', label: 'Проекты', built: false }, // DEMO-08
  { href: '/about', label: 'О компании', built: false }, // DEMO-10
  { href: '/contacts', label: 'Контакты', built: false }, // DEMO-11
];

export const privacyRoute: Route = { href: '/privacy', label: 'Политика конфиденциальности', built: false }; // DEMO-12

export const pendingRoutes = [...mainNav, privacyRoute].filter((r) => !r.built).map((r) => r.href);

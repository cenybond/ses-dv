// Базовый путь сайта (PUBLIC_BASE_PATH): на ses-dv.ru пустой, в публичной демоверсии GitHub Pages — /ses-dv. Адреса разделов и окон в скриптах записаны от корня
// (/services, /projects/<проект>); toLocal снимает базовый путь с адреса из браузера, toPublic добавляет его к адресу, который скрипт пишет в историю.
export const basePath = import.meta.env.BASE_URL.replace(//$/, '');
export const toLocal = (path: string): string => (basePath && (path === basePath || path.startsWith(basePath + '/')) ? path.slice(basePath.length) || '/' : path);
export const toPublic = (path: string): string => (basePath && path.startsWith('/') && !path.startsWith(basePath + '/') && path !== basePath ? basePath + path : path);

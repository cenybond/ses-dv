// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  base: process.env.PUBLIC_BASE_PATH || '/',
  site: process.env.PUBLIC_SITE_URL || 'https://ses-dv.ru',
  // Демо открывается с любого статического хостинга и из корня домена; адрес хостинга не определён (Q-28).
  vite: {
    cacheDir: '.astro/vite-cache',
    plugins: [tailwindcss()],
    build: {
      // Шрифты и логотипы остаются отдельными файлами, а не data: URI (кэш, проверка путей в dist).
      assetsInlineLimit: 0,
    },
  },
});

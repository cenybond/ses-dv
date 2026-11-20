import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Страницы /cookies и /consent остаются в демоверсии по просьбе владельца (2026-11-21): на них пометка «проект для согласования». /privacy удалена (PROD-25).
const base = '/ses-dv';
async function processDirectory(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await processDirectory(path);
    else if (entry.name.endsWith('.html')) {
      let html = await readFile(path, 'utf8');
      // Astro applies base to generated assets; authored root links need the prefix too.
      html = html.replace(/\b(href|src|action)="\/(?!\/|ses-dv(?:\/|"|#))([^\"]*)"/g,
        (_, attr, rest) => `${attr}="${base}/${rest}"`);
      await writeFile(path, html);
    }
  }
}
await processDirectory('dist');

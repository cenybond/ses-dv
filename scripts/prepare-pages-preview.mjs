import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// The preview is public: remove unapproved legal drafts before upload.
for (const route of ['privacy', 'consent', 'cookies']) {
  await rm(join('dist', route), { recursive: true, force: true });
}
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
      if (/\b(?:href|src|action)="\/ses-dv\/(?:privacy|consent|cookies)(?:[\/#"?])/.test(html)) {
        throw new Error(`Legal draft link found in ${path}`);
      }
      await writeFile(path, html);
    }
  }
}
await processDirectory('dist');

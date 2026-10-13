// Генерирует src/styles/theme.generated.css (@theme для Tailwind) из design/system/tokens.css.
// tokens.css — единственный источник значений; руками generated-файл не править.
// `node scripts/sync-theme.mjs --check` — только сверка (код 1, если файл устарел).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tokensPath = fileURLToPath(new URL('../design/system/tokens.css', import.meta.url));
const outPath = fileURLToPath(new URL('../src/styles/theme.generated.css', import.meta.url));

/** Токены, которые становятся темой Tailwind (имена совпадают с пространствами имён Tailwind). */
const BRIDGED = /^--(color|radius|shadow|font)-/;

export function readTokens(css = readFileSync(tokensPath, 'utf8')) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = noComments.match(/:root\s*{([\s\S]*)}/);
  if (!root) throw new Error('tokens.css: блок :root не найден');
  const tokens = new Map();
  for (const decl of root[1].split(/;(?![^(]*\))/)) {
    const m = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
    if (m) tokens.set(m[1], m[2].replace(/\s+/g, ' '));
  }
  return tokens;
}

export function buildTheme(tokens = readTokens()) {
  const lines = [...tokens]
    .filter(([name]) => BRIDGED.test(name))
    // --font-head/--font-text — семейства; --type-* и --ls-* сюда не входят
    .map(([name, value]) => `  ${name}: ${value};`);
  return [
    '/* СГЕНЕРИРОВАНО scripts/sync-theme.mjs из design/system/tokens.css. Не править вручную: npm run sync-theme. */',
    '@theme {',
    '  --spacing: 0.25rem; /* шаг 4 px, совпадает с --space-N (p-4 = 16 px) */',
    '  --breakpoint-sm: 640px; /* канонические брейкпоинты, DESIGN-SYSTEM §5 */',
    '  --breakpoint-md: 960px;',
    ...lines,
    '}',
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = buildTheme();
  if (process.argv.includes('--check')) {
    const current = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== next) {
      console.error('theme.generated.css устарел: запустите npm run sync-theme');
      process.exit(1);
    }
    console.log('theme.generated.css соответствует tokens.css');
  } else {
    writeFileSync(outPath, next);
    console.log('Записан src/styles/theme.generated.css');
  }
}

// Проверка использования токенов дизайн-системы (CLAUDE.md: «только токены, без HEX и новых размеров в компонентах»).
// 1. src/styles/theme.generated.css соответствует design/system/tokens.css.
// 2. В src/ нет HEX, rgb()/rgba()/hsl() и произвольных размеров Tailwind вида [12px] (кроме theme.generated.css).
// 3. Все var(--…) в src/ определены в tokens.css или system.css.
// 4. Контраст ключевых пар токенов не ниже порогов DESIGN-SYSTEM §3.
// 5. В собранном CSS нет самоссылающихся переменных (--x:var(--x)).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTheme, readTokens } from './sync-theme.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// 1. тема Tailwind ← tokens.css
const themePath = join(root, 'src/styles/theme.generated.css');
if (!existsSync(themePath) || readFileSync(themePath, 'utf8').replace(/\r\n/g, '\n') !== buildTheme()) {
  fail('src/styles/theme.generated.css не соответствует tokens.css (npm run sync-theme)');
}

// 2–3. файлы src/
const tokens = readTokens();
const systemCss = readFileSync(join(root, 'design/system/system.css'), 'utf8');
const defined = new Set([...tokens.keys(), ...[...systemCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])]);
const files = walk(join(root, 'src')).filter(
  (f) => ['.astro', '.ts', '.css'].includes(extname(f)) && !f.endsWith('theme.generated.css'),
);
const HEX = /(?<![\w&"'/=#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;
const ARBITRARY = /\[(?:-?\d*\.?\d+(?:px|rem|em|vw|vh|%))\]/g;
for (const file of files) {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\*.*?\*\//g, '').replace(/^\s*\/\/.*$/, '');
    for (const [re, what] of [
      [HEX, 'HEX-цвет'],
      [FUNC, 'цветовая функция'],
      [ARBITRARY, 'произвольный размер Tailwind'],
    ]) {
      for (const m of code.matchAll(re)) fail(`${rel}:${i + 1}: ${what} «${m[0]}» вне токенов`);
    }
    for (const m of code.matchAll(/var\((--[\w-]+)/g)) {
      if (!defined.has(m[1])) fail(`${rel}:${i + 1}: переменная ${m[1]} не определена в tokens.css/system.css`);
    }
  });
}

// 4. контраст (WCAG 2.x), пороги из DESIGN-SYSTEM §3
const hex = (name) => {
  const v = tokens.get(name);
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`Токен ${name} не HEX: ${v}`);
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS = [
  ['--color-text', '--color-bg', 4.5],
  ['--color-text-muted', '--color-bg', 4.5],
  ['--color-text-muted', '--color-bg-alt', 4.5],
  ['--color-brand', '--color-bg', 4.5],
  ['--color-on-brand', '--color-brand', 4.5],
  ['--color-on-accent', '--color-accent', 4.5],
  ['--color-text-on-dark', '--color-bg-dark', 4.5],
  ['--color-text-on-dark-muted', '--color-bg-dark', 4.5],
  ['--color-error', '--color-surface', 4.5],
  ['--color-placeholder', '--color-surface', 4.5],
  ['--color-focus', '--color-bg', 3],
  ['--color-focus-on-dark', '--color-bg-dark', 3],
  ['--color-border-strong', '--color-surface', 3],
];
for (const [fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  if (r < min) fail(`Контраст ${fg} / ${bg} = ${r.toFixed(2)} : 1 (< ${min} : 1)`);
}

// 5. собранный CSS
const distAstro = join(root, 'dist/_astro');
let builtCss = 0;
if (existsSync(distAstro)) {
  for (const f of readdirSync(distAstro).filter((n) => n.endsWith('.css'))) {
    builtCss++;
    const css = readFileSync(join(distAstro, f), 'utf8');
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*var\(\s*\1\s*[,)]/g)) fail(`dist/_astro/${f}: самоссылка ${m[1]}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  console.error(`\ncheck-tokens: ${errors.length} ошибок`);
  process.exit(1);
}
console.log(
  `check-tokens: OK — ${files.length} файлов src/, ${defined.size} токенов, ${PAIRS.length} пар контраста, CSS в dist: ${builtCss}`,
);

// Разбор снимков исходного контента docs/content/source/*.md (PHASE 1A) для check-copy.
// Единица (unit) — строка блока Tilda вида `[МЕТКА] текст`; продолжение строки (с отступом) относится к той же единице.
// Допустимая нормализация только одна (N-1): окончания строк CRLF → LF. Всё остальное сравнивается побайтно.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LABEL = /^\[(H[1-6]|TITLE|TEXT|BUTTON)\] ?(.*)$/;
const BLOCK = /^### (rec\d+) · type (\d+)/;

export function readLf(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

/** @returns {{file: string, raw: string, blocks: Map<string, {n: number, label: string, text: string}[]>}} */
export function loadSnapshot(sourceDir, file) {
  const path = join(sourceDir, file);
  if (!existsSync(path)) throw new Error(`снимок не найден: ${file}`);
  const raw = readLf(path);
  const lines = raw.split('\n');
  const blocks = new Map();
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const head = BLOCK.exec(lines[i]);
    if (head) {
      current = head[1];
      if (blocks.has(current)) throw new Error(`${file}: блок ${current} встречается дважды`);
      blocks.set(current, []);
      continue;
    }
    if (current && lines[i] === '```text') {
      const units = blocks.get(current);
      for (i++; i < lines.length && lines[i] !== '```'; i++) {
        const m = LABEL.exec(lines[i]);
        if (m) units.push({ n: units.length + 1, label: m[1], text: m[2] });
        else if (units.length) units[units.length - 1].text += `\n${lines[i]}`;
        else throw new Error(`${file}: строка вне единицы в блоке ${current}`);
      }
      current = null;
    }
  }
  return { file, raw, blocks };
}

const REF = /^([\w.-]+\.md)#(?:(rec\d+)\/(\d+)(?:-(\d+))?|quote:(.+)|cell:(.+))$/;

/**
 * Ссылка на источник (SourceRef):
 *   файл.md#recNNN/N     — единица N блока;
 *   файл.md#recNNN/N-M   — единицы N…M подряд, склеенные одним пробелом (N-2);
 *   файл.md#quote:Текст  — текст в «ёлочках» в произвольном месте снимка (подписи, не вынесенные в блоки);
 *   файл.md#cell:Текст   — ячейка таблицы `| Текст |` снимка.
 * @returns {{text: string, units: {file: string, block: string, n: number}[], joined: boolean}}
 */
export function resolveRef(cache, sourceDir, ref) {
  const m = REF.exec(ref);
  if (!m) throw new Error(`неверный формат ссылки: «${ref}»`);
  const [, file, block, from, to, quote, cell] = m;
  if (!cache.has(file)) cache.set(file, loadSnapshot(sourceDir, file));
  const snap = cache.get(file);
  if (quote !== undefined) {
    if (!snap.raw.includes(`«${quote}»`)) throw new Error(`${file}: нет «${quote}»`);
    return { text: quote, units: [], joined: false };
  }
  if (cell !== undefined) {
    if (!snap.raw.split('\n').some((l) => l.startsWith('|') && l.split('|').slice(1, -1).map((c) => c.trim()).includes(cell))) {
      throw new Error(`${file}: нет ячейки «${cell}»`);
    }
    return { text: cell, units: [], joined: false };
  }
  const units = snap.blocks.get(block);
  if (!units) throw new Error(`${file}: нет блока ${block}`);
  const a = Number(from);
  const b = to === undefined ? a : Number(to);
  if (a < 1 || b < a || b > units.length) throw new Error(`${file}#${block}: единицы ${a}-${b} вне диапазона 1…${units.length}`);
  const slice = units.slice(a - 1, b);
  if (slice.length > 1 && new Set(slice.map((u) => u.label)).size !== 1) {
    throw new Error(`${file}#${block}/${a}-${b}: склейка строк с разными метками (${slice.map((u) => u.label).join(', ')})`);
  }
  return {
    text: slice.map((u) => u.text).join(' '),
    units: slice.map((u) => ({ file, block, n: u.n })),
    joined: slice.length > 1,
  };
}

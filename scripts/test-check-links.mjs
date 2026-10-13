// Негативные тесты check-links (DEMO-04): во ВРЕМЕННОЙ копии dist/ намеренно ломаются ссылки и aria-current,
// проверка обязана упасть с ожидаемой причиной. Исходный dist/ не меняется. Запуск: npm run test-check-links (после npm run build).
// Контрольный прогон без изменений (положительный) обязан пройти — иначе тест не доказывает ничего.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const dist = join(repo, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ не найден: сначала npm run build');
  process.exit(1);
}
const tmp = mkdtempSync(join(tmpdir(), 'ses-check-links-'));
const work = join(tmp, 'dist');

// file — страница в dist; find/replace — строка или регулярка (первое вхождение); expect — регулярка в выводе проверки.
const ABOUT = '<li><a href="/about">О компании</a></li>'; // пункт подвала на любой странице, кроме /about
const cases = [
  { name: 'пустой href', file: 'services/index.html', find: ABOUT, replace: '<li><a href="">О компании</a></li>', expect: /пустой href/ },
  { name: 'href="#"', file: 'services/index.html', find: ABOUT, replace: '<li><a href="#">О компании</a></li>', expect: /href="#"/ },
  { name: 'javascript:', file: 'services/index.html', find: ABOUT, replace: '<li><a href="javascript:void(0)">О компании</a></li>', expect: /javascript:/ },
  { name: 'ссылка на несуществующую страницу', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/team">О компании</a></li>', expect: /несуществующую страницу «\/team»/ },
  { name: 'ссылка на старый URL действующего сайта (страницы нет)', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/hope">О компании</a></li>', expect: /старый URL действующего сайта/ },
  { name: 'ссылка на исключённый раздел «Благодарности»', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/gratitude">О компании</a></li>', expect: /исключённый раздел/ },
  { name: 'ссылка на исключённый раздел «Оснащение»', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/mtb">О компании</a></li>', expect: /исключённый раздел/ },
  { name: 'исключённый раздел по тексту ссылки', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/contacts">Благодарности</a></li>', expect: /исключённый раздел по тексту/ },
  { name: 'абсолютная ссылка на ses-dv.ru', file: 'services/index.html', find: ABOUT, replace: '<li><a href="https://ses-dv.ru/about">О компании</a></li>', expect: /старый сайт/ },
  { name: 'ссылка на Tilda', file: 'services/index.html', find: ABOUT, replace: '<li><a href="https://static.tildacdn.com/page.html">О компании</a></li>', expect: /старый сайт/ },
  { name: 'старый URL вида /pageNNN.html', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/page55167833.html">О компании</a></li>', expect: /расширение \.html/ },
  { name: 'произвольный внешний сайт', file: 'services/index.html', find: ABOUT, replace: '<li><a href="https://example.com/">О компании</a></li>', expect: /недопустимая внешняя ссылка/ },
  { name: 'якорь на странице без id', file: 'services/index.html', find: ABOUT, replace: '<li><a href="#nowhere">О компании</a></li>', expect: /нет id="nowhere"/ },
  { name: 'якорь на другой странице без id', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/contacts#s-99">О компании</a></li>', expect: /нет id="s-99"/ },
  { name: 'пустой фрагмент', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/contacts#">О компании</a></li>', expect: /пустой фрагмент/ },
  { name: 'tel: с пробелами и восьмёркой', file: 'services/index.html', find: 'href="tel:+79244999444"', replace: 'href="tel:8 924 499 94 44"', expect: /некорректный tel:/ },
  { name: 'mailto: с префиксом «e-mail:»', file: 'services/index.html', find: 'href="mailto:doc@ses-dv.ru"', replace: 'href="mailto:e-mail:doc@ses-dv.ru"', expect: /некорректный mailto:/ },
  { name: 'mailto: без домена', file: 'services/index.html', find: 'href="mailto:doc@ses-dv.ru"', replace: 'href="mailto:doc"', expect: /некорректный mailto:/ },
  { name: 'WhatsApp с предзаполненным текстом', file: 'services/index.html', find: 'href="tel:+79244999444"', replace: 'href="https://wa.me/79244999444?text=privet"', expect: /некорректная ссылка WhatsApp/ },
  { name: 'относительный внутренний путь', file: 'services/index.html', find: ABOUT, replace: '<li><a href="contacts">О компании</a></li>', expect: /относительный внутренний путь/ },
  { name: 'путь с .html', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/contacts.html">О компании</a></li>', expect: /расширение \.html/ },
  { name: 'путь с двойным слэшем', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/projects//tlt">О компании</a></li>', expect: /двойной слэш/ },
  { name: 'путь с query-строкой', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/contacts?x=1">О компании</a></li>', expect: /query-строка/ },
  { name: 'target=_blank без noopener', file: 'services/index.html', find: ABOUT, replace: '<li><a href="/privacy" target="_blank">О компании</a></li>', expect: /без rel="noopener"/ },
  { name: 'нет aria-current у активного пункта шапки', file: 'services/index.html', find: '<li><a href="/services" aria-current="page">Услуги</a></li>', replace: '<li><a href="/services">Услуги</a></li>', expect: /нет aria-current="page"/ },
  { name: 'aria-current на неактивном пункте', file: 'services/index.html', find: '<li><a href="/projects">Проекты</a></li>', replace: '<li><a href="/projects" aria-current="page">Проекты</a></li>', expect: /ожидается отсутствие атрибута/ },
  { name: 'aria-current с недопустимым значением', file: 'services/index.html', find: 'aria-current="page">Услуги', replace: 'aria-current="location">Услуги', expect: /допустимы page и true/ },
  { name: 'aria-current на главной (не пункт навигации)', file: 'index.html', find: '<li><a href="/services">Услуги</a></li>', replace: '<li><a href="/services" aria-current="page">Услуги</a></li>', expect: /ожидается отсутствие атрибута/ },
  { name: 'у страницы проекта нет aria-current="true" у «Проекты»', file: 'projects/tlt/index.html', find: '<a href="/projects" aria-current="true">Проекты</a>', replace: '<a href="/projects">Проекты</a>', expect: /нет aria-current="true"/ },
  { name: 'на странице проекта «Проекты» помечены как page', file: 'projects/tlt/index.html', find: '<a href="/projects" aria-current="true">Проекты</a>', replace: '<a href="/projects" aria-current="page">Проекты</a>', expect: /ожидается true/ },
  { name: 'нет aria-current у ссылки в подвале на текущую страницу', file: 'privacy/index.html', find: /(<a class="link-inline link-inline--light" href="\/privacy") aria-current="page"/, replace: '$1', expect: /нет aria-current="page"/ },
  { name: 'нет основной навигации', file: 'services/index.html', find: 'aria-label="Основная навигация"', replace: 'aria-label="Другая навигация"', expect: /нет навигации «Основная навигация»/ },
  { name: 'aria-current на странице 404', file: '404.html', find: '<li><a href="/services">Услуги</a></li>', replace: '<li><a href="/services" aria-current="page">Услуги</a></li>', expect: /не пункт навигации/ },
];

let failed = 0;
const run = () => spawnSync(process.execPath, [join(repo, 'scripts/check-links.mjs'), '--dist', work], { encoding: 'utf8' });
const reset = () => {
  rmSync(work, { recursive: true, force: true });
  cpSync(dist, work, { recursive: true });
};
const report = (ok, name, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `\n    ${detail}` : ''}`);
};

try {
  reset();
  const control = run();
  report(control.status === 0, 'контроль: неизменённый dist/ проходит', control.status === 0 ? '' : (control.stderr || control.stdout).trim());
  if (control.status !== 0) process.exit(1);

  for (const c of cases) {
    reset();
    const path = join(work, c.file);
    const before = readFileSync(path, 'utf8');
    const after = before.replace(c.find, c.replace);
    if (after === before) {
      report(false, c.name, `тест некорректен: фрагмент не найден в ${c.file}`);
      continue;
    }
    writeFileSync(path, after);
    const r = run();
    const output = `${r.stdout}${r.stderr}`;
    const ok = r.status !== 0 && c.expect.test(output);
    report(ok, c.name, ok ? '' : r.status === 0 ? 'проверка НЕ упала' : `упала с другой причиной: ${output.split('\n')[0]}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\ntest-check-links: не пройдено ${failed} из ${cases.length + 1}` : `\ntest-check-links: OK — ${cases.length} негативных тестов + контроль`);
process.exit(failed ? 1 : 0);

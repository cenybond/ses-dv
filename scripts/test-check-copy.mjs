// Негативные тесты check-copy (DEMO-03): во ВРЕМЕННОЙ копии репозитория намеренно ломается текст, данные, снимки и документы,
// проверка обязана упасть с ожидаемой причиной. Исходные файлы проекта не меняются. Запуск: npm run test-check-copy.
// Контрольный прогон без изменений (положительный) обязан пройти — иначе тест не доказывает ничего.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const checker = join(repo, 'scripts/check-copy.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'ses-check-copy-'));
const pristine = join(tmp, 'pristine');
const work = join(tmp, 'work');

mkdirSync(pristine);
for (const p of ['src', 'docs/content/source', 'SPEC-DEMO.md', 'DECISIONS.md', 'docs/INFORMATION-ARCHITECTURE.md', 'package.json']) {
  cpSync(join(repo, p), join(pristine, p), { recursive: true });
}

// find/replace — строки (первое вхождение) ; add — создать файл; expect — регулярка в выводе проверки.
const cases = [
  { name: 'регистр: «монтаж» со строчной буквы', file: 'src/data/source/services.ts', find: "text: 'Монтаж объектов видеонаблюдения'", replace: "text: 'монтаж объектов видеонаблюдения'", expect: /дословность.*регистр/ },
  { name: 'пунктуация: точка в конце названия услуги', file: 'src/data/source/services.ts', find: '(методом ГНБ)\'', replace: "(методом ГНБ).'", expect: /дословность.*пунктуация/ },
  { name: 'пунктуация: кавычки «» вместо "" в названии проекта', file: 'src/data/source/projects.ts', find: 'ГПОБУ АО "АКИК"', replace: 'ГПОБУ АО «АКИК»', expect: /дословность.*пунктуация/ },
  { name: 'пробелы: неразрывный пробел заменён обычным', file: 'src/data/source/projects.ts', find: 'ул.\\u00A0Калинина', replace: 'ул. Калинина', expect: /дословность.*пробелы/ },
  { name: 'пробелы: двойной пробел', file: 'src/data/source/projects.ts', find: 'Благовещенская ТЭЦ', replace: 'Благовещенская  ТЭЦ', expect: /дословность.*пробелы/ },
  { name: 'автоисправление опечатки «коплексов» в данных ТЛТ', file: 'src/data/source/tlt.ts', find: 'Перетарочных коплексов', replace: 'Перетарочных комплексов', expect: /дословность.*текст/ },
  { name: 'автоисправление опечатки «приезжаейте» в контактах', file: 'src/data/source/contacts.ts', find: 'пишите или приезжаейте', replace: 'пишите или приезжайте', expect: /дословность.*текст/ },
  { name: 'лишнее слово в названии первого вида работ ТЛТ (повтор убран)', file: 'src/data/source/tlt.ts', find: 'тепловодоснабжения и ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и напорной', replace: 'тепловодоснабжения и напорной', expect: /дословность/ },
  { name: 'тире: en dash заменён дефисом', file: 'src/data/source/tlt.ts', find: 'Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и ГНБ', replace: 'Д-1 Хэйхэ - Благовещенск для последующего устройства сетей тепловодоснабжения и ГНБ', expect: /дословность.*пунктуация/ },
  { name: 'опечатка в телефоне', file: 'src/data/source/contacts.ts', find: '+7 (924) 499-94-44', replace: '+7 (924) 499-94-45', expect: /дословность/ },
  { name: 'опечатка в преимуществе', file: 'src/data/source/advantages.ts', find: 'Работаем по Локально-Сметным Расчетам', replace: 'Работаем по локально-сметным расчетам', expect: /дословность.*регистр/ },
  { name: 'опечатка в абзаце политики', file: 'src/data/source/privacy.ts', find: 'Общие положения', replace: 'Общие положения.', expect: /дословность/ },
  { name: 'подпись ui из снимка изменена («Заказать!»)', file: 'src/data/ui.ts', find: "order: 'Заказать',", replace: "order: 'Заказать!',", expect: /дословность/ },
  { name: 'подпись ui из SPEC изменена', file: 'src/data/ui.ts', find: "photo: 'Место для фотографии'", replace: "photo: 'Здесь будет фото'", expect: /\[SPEC\]/ },
  { name: 'удалена услуга S-09 (количество)', file: 'src/data/source/services.ts', find: /  \{ id: 's-09'.*\n/, replace: '', expect: /количество.*услуг 9/ },
  { name: 'удалён проект PRJ-13 (количество и полнота)', file: 'src/data/source/projects.ts', find: /  \{\n    id: 'prj-13',[\s\S]*?\n  \},\n/, replace: '', expect: /количество.*проектов 13/ },
  { name: 'удалён отдел (количество)', file: 'src/data/source/company.ts', find: /  \{ id: 'dep-04'.*\n/, replace: '', expect: /количество.*отделов 4/ },
  { name: 'пропущен вид работ ТЛТ (полнота исходного блока)', file: 'src/data/source/tlt.ts', find: /  \{\n    id: 'prj-14-12',[\s\S]*?\n  \},\n/, replace: '', expect: /полнота.*оригинальный фрагмент пропущен/ },
  { name: 'повтор ID услуги', file: 'src/data/source/services.ts', find: "id: 's-02'", replace: "id: 's-01'", expect: /уникальность|\[ID\]/ },
  { name: 'ссылка на несуществующий блок снимка', file: 'src/data/source/services.ts', find: 'rec596139915/6', replace: 'rec000000000/6', expect: /\[ссылка\].*нет блока/ },
  { name: 'ссылка на чужую строку снимка', file: 'src/data/source/services.ts', find: 'rec596139915/4', replace: 'rec596139915/5', expect: /дословность/ },
  { name: 'ссылка на несуществующий файл снимка', file: 'src/data/source/services.ts', find: "src: 'services.md#rec596139915/8'", replace: "src: 'services-2.md#rec596139915/8'", expect: /\[ссылка\].*снимок не найден/ },
  { name: 'связь с несуществующей услугой', file: 'src/data/source/projects.ts', find: "serviceId: 's-04', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Устройство", replace: "serviceId: 's-99', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Устройство", expect: /неизвестной услугой/ },
  { name: 'проект главной с неизвестным ID', file: 'src/data/source/projects.ts', find: "'prj-08', 'prj-01'", replace: "'prj-88', 'prj-01'", expect: /неизвестный проект/ },
  { name: 'порядок проектов главной изменён относительно SPEC', file: 'src/data/source/projects.ts', find: "ids: ['prj-14', 'prj-08', 'prj-01', 'prj-02', 'prj-09', 'prj-03']", replace: "ids: ['prj-08', 'prj-14', 'prj-01', 'prj-02', 'prj-09', 'prj-03']", expect: /\[SPEC\]/ },
  { name: 'проектов главной пять', file: 'src/data/source/projects.ts', find: "'prj-09', 'prj-03']", replace: "'prj-09']", expect: /количество.*главной 5/ },
  { name: 'вторая активная страница проекта', file: 'src/data/source/projects.ts', find: 'hasPage: false', replace: 'hasPage: true', expect: /страницы.*hasPage=true/ },
  { name: 'у ТЛТ нет активной страницы', file: 'src/data/source/projects.ts', find: 'hasPage: true', replace: 'hasPage: false', expect: /\[страницы\]/ },
  { name: 'вид работ ТЛТ получил страницу', file: 'src/data/source/tlt.ts', find: 'hasPage: false', replace: 'hasPage: true', expect: /страницы видов работ/ },
  { name: 'у «Проектирования» появилось придуманное описание', file: 'src/data/source/services.ts', find: "description: null, descriptionStatus: 'DESCRIPTION_PENDING'", replace: "description: 'Полный цикл проектирования', descriptionStatus: 'DESCRIPTION_PENDING'", expect: /описание должно быть null|вне SourceText/ },
  { name: 'у «Проектирования» снят статус ожидания', file: 'src/data/source/services.ts', find: "description: null, descriptionStatus: 'DESCRIPTION_PENDING' }", replace: "description: null, descriptionStatus: 'NONE_IN_SOURCE' }", expect: /S-10/ },
  { name: 'придуманное название S-10', file: 'src/data/source/services.ts', find: "text: 'Проектирование', decision: 'A-18'", replace: "text: 'Проектирование зданий', decision: 'A-18'", expect: /S-10/ },
  { name: 'придуманный текст вне SourceText (в данных компании)', file: 'src/data/source/company.ts', find: "status: 'PENDING_FROM_CLIENT',", replace: "status: 'PENDING_FROM_CLIENT', note: 'Работаем с 2005 года',", expect: /без источника/ },
  { name: 'придуманный год проекта', file: 'src/data/source/projects.ts', find: "slug: 'hope',", replace: "slug: 'hope', year: '2021',", expect: /без источника|\[поля\]/ },
  { name: 'старый адрес в новых данных', file: 'src/data/source/contacts.ts', find: "export const address = { status: 'ADDRESS_PENDING' } as const;", replace: "export const address = { status: 'ADDRESS_PENDING', note: 'ул. Александра Кириллова, д. 53/2, офис 9' } as const;", expect: /старый адрес/ },
  { name: 'старый адрес в компоненте', add: 'src/components/Old.astro', content: '<p>ул. Александра Кириллова</p>', expect: /старый адрес/ },
  { name: 'ссылка на старый сайт в компоненте', add: 'src/components/Link.astro', content: '<a href="https://ses-dv.ru/services">старый</a>', expect: /старый сайт/ },
  { name: 'внутренний маркер в UI-тексте', file: 'src/data/ui.ts', find: "serviceDescription: 'Описание будет добавлено'", replace: "serviceDescription: 'DESCRIPTION_PENDING'", expect: /маркеры.*DESCRIPTION_PENDING/ },
  { name: 'ADDRESS_PENDING в UI', file: 'src/data/ui.ts', find: "address: 'Адрес уточняется'", replace: "address: 'ADDRESS_PENDING'", expect: /маркеры.*ADDRESS_PENDING/ },
  { name: 'маркер в собранной странице', add: 'dist/index.html', content: '<p>SOURCE_SUPPORTED</p>', expect: /маркеры.*SOURCE_SUPPORTED/ },
  { name: 'связь стала CLIENT_APPROVED без подтверждения', file: 'src/data/source/projects.ts', find: 'clientApproved: false, evidence', replace: 'clientApproved: true, evidence', expect: /CLIENT_APPROVED отсутствует/ },
  { name: 'в данные попала PROPOSED-связь', file: 'src/data/source/projects.ts', find: "basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence", replace: "basis: 'PROPOSED', clientApproved: false, evidence", expect: /только SOURCE_SUPPORTED/ },
  { name: 'удалена подтверждённая связь', file: 'src/data/source/projects.ts', find: /    serviceLinks: \[\n      \{ serviceId: 's-02'.*clap\.md.*\n    \],\n/, replace: '    serviceLinks: [],\n', expect: /prj-04>s-02.*отсутствует в данных/ },
  { name: 'подмена строки-основания связи', file: 'src/data/source/projects.ts', find: "src: 'pns.md#rec659889680/9'", replace: "src: 'pns.md#rec659889680/8'", expect: /дословность/ },
  { name: 'матрица IA изменилась (связь стала PROPOSED)', file: 'docs/INFORMATION-ARCHITECTURE.md', find: '| **SOURCE_SUPPORTED** | нет |', replace: '| **PROPOSED** | нет |', expect: /\[IA\]|\[связи\]/ },
  { name: 'SPEC: другой проект в H-03', file: 'SPEC-DEMO.md', find: 'Благовещенская ТЭЦ, Санаторий', replace: 'Санаторий', expect: /\[SPEC\]/ },
  { name: 'три преимущества главной заменены на два', file: 'src/data/source/advantages.ts', find: "ids: ['adv-01', 'adv-02', 'adv-03']", replace: "ids: ['adv-01', 'adv-02']", expect: /количество.*преимуществ главной 2/ },
  { name: 'порядок преимуществ изменён', file: 'src/data/source/advantages.ts', find: "ids: ['adv-01', 'adv-02', 'adv-03']", replace: "ids: ['adv-01', 'adv-03', 'adv-02']", expect: /P-17/ },
  { name: 'отсутствует обязательное поле проекта', file: 'src/data/source/projects.ts', find: "    snapshot: 'hope.md',\n", replace: '', expect: /нет обязательного поля «snapshot»/ },
  { name: 'снимок страницы проекта не существует', file: 'src/data/source/projects.ts', find: "snapshot: 'hope.md'", replace: "snapshot: 'nope.md'", expect: /нет снимка/ },
  { name: 'изображение — ссылка на старый сайт', file: 'src/data/source/projects.ts', find: '    image: null,', replace: "    image: { src: 'https://static.tildacdn.com/x.jpg', alt: '' },", expect: /изображение/ },
  { name: 'создан модуль новостей', add: 'src/data/source/news.ts', content: 'export const news = [];', expect: /новости/ },
  { name: 'телефон: неверный формат tel:', file: 'src/data/source/contacts.ts', find: "href: 'tel:+79244999444'", replace: "href: 'tel:+7 924 499 94 44'", expect: /href должен быть tel:/ },
  { name: 'e-mail: ошибочный префикс mailto:e-mail:', file: 'src/data/source/contacts.ts', find: "href: 'mailto:doc@ses-dv.ru'", replace: "href: 'mailto:e-mail:doc@ses-dv.ru'", expect: /mailto/ },
  { name: 'WhatsApp-ссылка, которой нет в источнике', file: 'src/data/source/contacts.ts', find: "'https://wa.me/79244480859'", replace: "'https://wa.me/79990000000'", expect: /WhatsApp/ },
  { name: 'статус контактов выставлен как подтверждённый', file: 'src/data/source/contacts.ts', find: "status: 'PENDING_CLIENT_CONFIRMATION',", replace: "status: 'CONFIRMED_BY_CLIENT',", expect: /не подтверждена заказчиком/ },
  { name: 'ИЗМЕНЁН СНИМОК: название услуги в источнике (данные ≠ источник)', file: 'docs/content/source/services.md', find: '[TITLE] Геодезическое сопровождение строительства\n', replace: '[TITLE] Геодезическое сопровождение строительства.\n', expect: /дословность/ },
  { name: 'НОВЫЙ ТЕКСТ В СНИМКЕ не отражён в данных (полнота)', file: 'docs/content/source/services.md', find: '[TEXT] Заказать\n```\n\n### rec596170576', replace: '[TEXT] Заказать\n[TITLE] Новая услуга\n```\n\n### rec596170576', expect: /полнота.*Новая услуга/ },
  { name: 'НОВЫЙ БЛОК В СНИМКЕ без решения', file: 'docs/content/source/contacts.md', find: '## Кнопки (CTA)', replace: '### rec999999999 · type 1\n\n```text\n[TEXT] Новый блок\n```\n\n## Кнопки (CTA)', expect: /блок с текстом не учтён/ },
  { name: 'ИЗМЕНЁН СНИМОК: оригинал исключённого адреса попал в данные', file: 'src/data/source/contacts.ts', find: "export const address = { status: 'ADDRESS_PENDING' } as const;", replace: "export const address = { status: 'ADDRESS_PENDING' } as const;\nexport const legacy = { text: 'Амурская обл, г. Благовещенск,', src: 'contacts.md#rec596804757/5' };", expect: /исключена.*используется|старый адрес/ },
];

function mutate(c) {
  if (c.add) {
    const p = join(work, c.add);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, c.content, 'utf8');
    return;
  }
  const p = join(work, c.file);
  const before = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const after = before.replace(c.find, c.replace);
  if (after === before) throw new Error('мутация не применилась (шаблон не найден)');
  writeFileSync(p, after, 'utf8');
}
const run = () => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', checker, '--root', work], { encoding: 'utf8' });
const reset = () => {
  rmSync(work, { recursive: true, force: true });
  cpSync(pristine, work, { recursive: true });
};

let failed = 0;
try {
  reset();
  const base = run();
  const baseOk = base.status === 0;
  console.log(`${baseOk ? 'PASS' : 'FAIL'}  контрольный прогон без изменений проходит${baseOk ? '' : `\n${base.stderr}${base.stdout}`}`);
  if (!baseOk) failed++;
  for (const c of cases) {
    reset();
    let verdict;
    try {
      mutate(c);
      const r = run();
      const out = `${r.stdout}${r.stderr}`;
      if (r.status === 0) verdict = 'проверка НЕ упала (пропустила изменение)';
      else if (!c.expect.test(out)) verdict = `упала, но не по той причине; ожидалось ${c.expect}:\n${out.split('\n').slice(0, 6).join('\n')}`;
    } catch (e) {
      verdict = e.message;
    }
    if (verdict) failed++;
    console.log(`${verdict ? 'FAIL' : 'PASS'}  ${c.name}${verdict ? `\n      ${verdict}` : ''}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `\ntest-check-copy: ПРОВАЛЕНО ${failed} из ${cases.length + 1}` : `\ntest-check-copy: OK — ${cases.length} негативных проверок упали, как требуется, и 1 контрольная прошла`);
process.exit(failed ? 1 : 0);

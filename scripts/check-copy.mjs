// Проверка слоя данных и дословности текстов (DEMO-03). Запуск: npm run check-copy [-- --root <папка>].
// Принцип: данные не исправляются и не нормализуются — расхождение с источником это ошибка.
//
// Единственная допустимая нормализация (N-1): окончания строк CRLF → LF при чтении снимков. Регистр, пунктуация, пробелы
// (включая неразрывные), кавычки и опечатки источника сравниваются побайтно. Склейка соседних строк одной метки одним
// пробелом (N-2) допустима только для ссылок вида `файл.md#recNNN/N-M` (названия, разбитые источником на две строки).
//
// Что проверяется:
//  1. Каждый SourceText из src/data/source/* равен строке снимка docs/content/source/, на которую указывает `src`.
//  2. Любая строка данных вне SourceText — только служебное поле (id, slug, href, статус…); «голый» текст запрещён.
//  3. Полнота: каждая строка текстовых блоков основных снимков либо использована в данных, либо явно исключена с причиной (COVERAGE).
//  4. Количества, уникальность ID, обязательные поля, ссылки между сущностями, существование снимков и изображений.
//  5. Связи услуга ↔ проект: только SOURCE_SUPPORTED, совпадают с матрицей IA §7.4, у каждой есть строка-основание в снимке.
//  6. Подписи ui.ts: sourced-подписи равны снимкам, подписи SPEC равны тексту SPEC-DEMO.md, внутренних маркеров нет.
//  7. Старый адрес, ссылки на старый сайт, данные новостей — отсутствуют в src/ и dist/.
// Негативные тесты проверки: scripts/test-check-copy.mjs.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSnapshot, resolveRef, readLf } from './lib/snapshots.mjs';

const argRoot = process.argv.indexOf('--root');
const root = argRoot > 0 ? process.argv[argRoot + 1] : fileURLToPath(new URL('..', import.meta.url));
const sourceDir = join(root, 'docs/content/source');
const errors = [];
let checks = 0;
const fail = (cat, msg) => errors.push(`[${cat}] ${msg}`);
const ok = (cond, cat, msg) => {
  checks++;
  if (!cond) fail(cat, msg);
  return cond;
};

// ---------- ожидания (источник — SPEC-DEMO, IA, DECISIONS) ----------
const EXPECT = { services: 10, projects: 14, workTypes: 12, advantages: 5, departments: 5, homeProjects: 6, homeAdvantages: 3, gallery: 6, phones: 2 };
const MARKERS = ['DESCRIPTION_PENDING', 'ADDRESS_PENDING', 'SOURCE_SUPPORTED', 'CLIENT_APPROVED', 'PENDING_CLIENT_CONFIRMATION', 'PENDING_FROM_CLIENT', 'NONE_IN_SOURCE'];
const STRUCTURAL_KEYS = new Set(['id', 'slug', 'snapshot', 'href', 'whatsapp', 'status', 'basis', 'decision', 'src', 'descriptionStatus', 'serviceId', 'derivedFrom', 'projectId', 'catalogHref', 'ids']);
// В строке H-03 SPEC-DEMO первый проект назван аббревиатурой.
const SPEC_ALIAS = { 'prj-14': 'ТЛТ' };
const skipAll =(reason) => ({ all: reason });
// Полнота: все текстовые блоки основных снимков должны быть учтены. `skip` — исключённые строки с причиной,
// `skipText` — исключённый повторяющийся текст, `dupOk` — повтор уже использованной строки того же блока (подпись кнопки).
const COVERAGE = {
  'home.md': {
    rec651850071: { skip: { 6: '«НОВОСТИ»: раздел исключён из демо (A-13)' } },
    rec651850072: skipAll('cookie-баннер: куки в демо не используются'),
    rec651850075: skipAll('СРО и допуски не показываются (A-15, Q-20)'),
    rec651850078: skipAll('отделы: данные берутся из about.md, дубль источника'),
    rec651850080: skipAll('«НАШИ ЗАКАЗЧИКИ»: логотипы заказчиков не используются (Q-10)'),
  },
  'services.md': {
    rec596139915: { dupOk: true },
    rec596170576: {},
  },
  'completed-projects.md': { rec596873402: {}, rec596873316: {} },
  'tlt.md': {
    rec596161305: {},
    rec606966693: { skipText: { Подробнее: 'кнопка «Подробнее» не выводится: страниц видов работ в демо нет (SPEC-DEMO §6.4 B6)' } },
  },
  'advantages.md': {
    rec596853171: {},
    rec597428669: skipAll('повтор блока обращения: тексты берутся из services.md (ui.cta)'),
  },
  'about.md': {
    rec595315447: {},
    rec613060679: skipAll('cookie-баннер: куки в демо не используются'),
    rec609496352: skipAll('«НОВОСТИ»: раздел исключён из демо (A-13)'),
    rec595863000: skipAll('СРО и допуски не показываются (A-15, Q-20); место для документов — ui.placeholders.documents'),
    rec596030242: {},
    rec596114731: skipAll('«НАШИ ЗАКАЗЧИКИ»: логотипы заказчиков не используются (Q-10)'),
  },
  'contacts.md': {
    rec596870778: {},
    rec596804757: { skip: { 5: 'старый адрес не переносится (ADDRESS_PENDING)', 6: 'старый адрес не переносится (ADDRESS_PENDING)' } },
  },
  'privacy.md': { rec596899666: {} },
};

// ---------- вспомогательное ----------
const cache = new Map();
const used = new Map(); // 'файл|блок' → Set(n)
const markUsed = (units) => {
  for (const { file, block, n } of units) {
    const key = `${file}|${block}`;
    if (!used.has(key)) used.set(key, new Set());
    used.get(key).add(n);
  }
};
const UNUSUAL = /[\u00A0\u2009\u2212\u2013\u2014]/g;
const show = (s) => JSON.stringify(s).replace(UNUSUAL, (c) => `\\u${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
// Классификация расхождения (только для сообщения об ошибке; решение «равно/не равно» всегда побайтное).
// Каскад: без пробелов → без пунктуации → без регистра; первая ступень, на которой тексты совпали, называет причину.
const stripWs = (s) => s.replace(/[\s\u00A0\u2009]+/g, '');
const stripPunct = (s) => s.replace(/[\p{P}\p{S}]/gu, '');
function diagnose(actual, expected) {
  let i = 0;
  while (i < actual.length && i < expected.length && actual[i] === expected[i]) i++;
  let kind = 'текст';
  if (stripWs(actual) === stripWs(expected)) kind = 'пробелы/неразрывные пробелы';
  else if (stripPunct(stripWs(actual)) === stripPunct(stripWs(expected))) kind = 'пунктуация/кавычки/тире';
  else if (stripPunct(stripWs(actual)).toLowerCase() === stripPunct(stripWs(expected)).toLowerCase()) kind = 'регистр';
  const near = (t) => show(t.slice(Math.max(0, i - 15), i + 25));
  return `${kind}; первое расхождение на символе ${i}: данные ${near(actual)} ≠ источник ${near(expected)}`;
}
function resolve(ref, where) {
  try {
    const r = resolveRef(cache, sourceDir, ref);
    markUsed(r.units);
    return r;
  } catch (e) {
    fail('ссылка', `${where}: ${e.message}`);
    return null;
  }
}
function checkSourceText(st, where) {
  checks++;
  if (typeof st.text !== 'string' || !st.text || typeof st.src !== 'string') return fail('поля', `${where}: нужны непустые text и src`);
  const r = resolve(st.src, where);
  if (r && r.text !== st.text) fail('дословность', `${where} (${st.src}): ${diagnose(st.text, r.text)}`);
}
const dig = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function uniq(list, what) {
  const seen = new Set();
  for (const x of list) {
    ok(!seen.has(x), 'уникальность', `${what}: повтор «${x}»`);
    seen.add(x);
  }
}
function req(obj, keys, where) {
  for (const k of keys) ok(obj != null && k in obj && obj[k] !== undefined, 'поля', `${where}: нет обязательного поля «${k}»`);
}
const seqIds = (list, prefix, what) => {
  ok(list.every((x, i) => x.id === `${prefix}${String(i + 1).padStart(2, '0')}`), 'ID', `${what}: ожидались ${prefix}01…${prefix}${String(list.length).padStart(2, '0')} подряд`);
  uniq(list.map((x) => x.id), `ID ${what}`);
};
const walkFiles = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walkFiles(p) : [p];
  });
const refUnitNums = (st) => {
  const m = /\/(\d+)(?:-(\d+))?$/.exec(st.src);
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [NaN, NaN];
};

// Непредвиденный сбой структуры данных — тоже ошибка проверки, а не «успех»: печатаем накопленное и падаем.
const onCrash = (e) => {
  fail('сбой проверки', String(e?.message ?? e).split('\n')[0]);
  finish();
};
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);

// ---------- загрузка данных ----------
const load = async (rel) => {
  try {
    return await import(pathToFileURL(join(root, 'src/data', rel)).href);
  } catch (e) {
    fail('загрузка', `src/data/${rel}: ${e.message.split('\n')[0]}`);
    return {};
  }
};
const [svc, prj, tltM, adv, comp, cont, priv, uiM, navM, detailsM, worksM, vacanciesM, poolM] = await Promise.all(
  ['source/services.ts', 'source/projects.ts', 'source/tlt.ts', 'source/advantages.ts', 'source/company.ts', 'source/contacts.ts', 'source/privacy.ts', 'ui.ts', 'nav.ts', 'source/project-details.ts', 'source/work-details.ts', 'source/vacancies.ts', 'source/content-texts.ts'].map(load),
);
if (errors.length) finish();

const specText = readLf(join(root, 'SPEC-DEMO.md'));
const iaText = readLf(join(root, 'docs/INFORMATION-ARCHITECTURE.md'));
const decisionsText = readLf(join(root, 'DECISIONS.md'));
const snapshotFiles = readdirSync(sourceDir).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md');

// ---------- 1–2. все SourceText и «голые» строки ----------
const sourceModules = { services: svc, projects: prj, tlt: tltM, advantages: adv, company: comp, contacts: cont, privacy: priv, projectdetails: detailsM, workdetails: worksM, vacancies: vacanciesM, content: poolM };
const seenObjects = new WeakSet();
const textOwners = new Map(); // text → путь первого объекта (дубли вне privacy)
let sourceTexts = 0;
let decisionTexts = 0;
function walk(value, path, key, moduleName) {
  if (value == null || typeof value === 'function') return;
  if (typeof value === 'string') {
    ok(STRUCTURAL_KEYS.has(key), 'без источника', `${path}: строка «${value.slice(0, 50)}» вне SourceText; служебные поля: ${[...STRUCTURAL_KEYS].join(', ')}`);
    return;
  }
  if (typeof value !== 'object') return;
  if (seenObjects.has(value)) return;
  seenObjects.add(value);
  if (!Array.isArray(value) && typeof value.text === 'string' && ('src' in value || 'decision' in value)) {
    if ('src' in value) {
      sourceTexts++;
      checkSourceText(value, path);
      // Дубли запрещены, кроме политики (повторы есть в самом источнике) и цитат-оснований связей (evidence цитирует страницу проекта).
      if (moduleName !== 'privacy' && !path.endsWith('.evidence')) {
        if (textOwners.has(value.text)) fail('дубль текста', `${path}: тот же текст уже есть в ${textOwners.get(value.text)} (одна запись на один текст)`);
        else textOwners.set(value.text, path);
      }
    } else {
      decisionTexts++;
      ok(new RegExp(`\\b${value.decision}\\b`).test(decisionsText), 'решение', `${path}: решение ${value.decision} не найдено в DECISIONS.md`);
      for (const f of snapshotFiles) {
        const snap = (cache.get(f) ?? (cache.set(f, loadSnapshot(sourceDir, f)), cache.get(f)));
        for (const units of snap.blocks.values()) ok(!units.some((u) => u.text === value.text), 'решение', `${path}: текст «${value.text}» есть в снимке ${f}: это уже источник, а не решение`);
      }
    }
    return;
  }
  for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, Array.isArray(value) ? key : k, moduleName);
}
for (const [name, mod] of Object.entries(sourceModules)) {
  for (const [exp, val] of Object.entries(mod)) walk(val, `${name}.${exp}`, exp, name);
}
ok(decisionTexts === 1, 'решение', `текстов по решению заказчика ожидался 1 («Проектирование», A-18), найдено ${decisionTexts}`);

// ---------- 4. услуги ----------
const { services } = svc;
ok(services?.length === EXPECT.services, 'количество', `услуг ${services?.length}, ожидалось ${EXPECT.services}`);
seqIds(services, 's-', 'услуг');
const serviceIds = new Set(services.map((s) => s.id));
services.forEach((s, i) => {
  req(s, ['id', 'title', 'description', 'descriptionStatus'], `услуга ${s.id}`);
  ok(s.description === null, 'услуги', `${s.id}: описание должно быть null (описаний нет в источнике и у заказчика)`);
  if (i < 9) {
    ok(typeof s.title.src === 'string' && s.title.src.startsWith('services.md#rec596139915/'), 'услуги', `${s.id}: название должно ссылаться на services.md#rec596139915`);
    ok(s.descriptionStatus === 'NONE_IN_SOURCE', 'услуги', `${s.id}: descriptionStatus должен быть NONE_IN_SOURCE`);
    if (i > 0) ok(refUnitNums(s.title)[0] > refUnitNums(services[i - 1].title)[1], 'порядок', `${s.id}: порядок услуг отличается от порядка источника`);
  } else {
    ok(s.title.decision === 'A-18' && s.title.text === 'Проектирование', 'услуги', 'S-10 должна быть «Проектирование» по решению A-18');
    ok(s.descriptionStatus === 'DESCRIPTION_PENDING' && s.description === null, 'услуги', 'S-10: description null и descriptionStatus DESCRIPTION_PENDING');
  }
});
ok(services.filter((s) => s.descriptionStatus === 'DESCRIPTION_PENDING').length === 1, 'услуги', 'DESCRIPTION_PENDING допустим только у S-10');

// ---------- проекты ----------
const { projects, homeProjects } = prj;
ok(projects?.length === EXPECT.projects, 'количество', `проектов ${projects?.length}, ожидалось ${EXPECT.projects}`);
seqIds(projects, 'prj-', 'проектов');
uniq(projects.map((p) => p.slug), 'slug проектов');
const projectIds = new Set(projects.map((p) => p.id));
const workTypes = tltM.tltWorkTypes ?? [];
const workTypeIds = new Set(workTypes.map((w) => w.id));
const pairs = new Set(); // 'prj-xx>s-xx' для сверки с IA
function checkLinks(owner, links, kind) {
  for (const l of links) {
    req(l, ['serviceId', 'basis', 'clientApproved'], `${owner}: связь`);
    ok(serviceIds.has(l.serviceId), 'ссылки', `${owner}: связь с неизвестной услугой «${l.serviceId}»`);
    ok(l.basis === 'SOURCE_SUPPORTED', 'связи', `${owner}→${l.serviceId}: в демо переносятся только SOURCE_SUPPORTED, найдено ${l.basis}`);
    ok(l.clientApproved === false, 'связи', `${owner}→${l.serviceId}: CLIENT_APPROVED отсутствует, clientApproved должно быть false`);
    pairs.add(`${owner}>${l.serviceId}`);
    if (l.derivedFrom) {
      ok(kind === 'project', 'связи', `${owner}: derivedFrom только у родителя`);
      for (const d of l.derivedFrom) {
        const child = workTypes.find((w) => w.id === d);
        ok(child && child.serviceLinks.some((cl) => cl.serviceId === l.serviceId), 'связи', `${owner}→${l.serviceId}: вид работ «${d}» не подтверждает связь`);
      }
    } else ok(!!l.evidence, 'связи', `${owner}→${l.serviceId}: нужна строка-основание evidence`);
  }
}
projects.forEach((p, i) => {
  req(p, ['id', 'slug', 'title', 'snapshot', 'image', 'hasPage', 'serviceLinks'], `проект ${p.id}`);
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug), 'slug', `${p.id}: недопустимый slug «${p.slug}»`);
  ok(p.title.src === `completed-projects.md#rec596873316/${i + 1}`, 'порядок', `${p.id}: название должно ссылаться на строку ${i + 1} каталога (порядок источника)`);
  ok(existsSync(join(sourceDir, p.snapshot)), 'снимок', `${p.id}: нет снимка docs/content/source/${p.snapshot}`);
  if (p.image !== null) {
    req(p.image, ['src', 'alt'], `${p.id}.image`);
    ok(!/^https?:|tilda|ses-dv\.ru/i.test(p.image.src) && existsSync(join(root, p.image.src)), 'изображение', `${p.id}: файл изображения «${p.image.src}» не найден в репозитории или это ссылка на старый сайт`);
  }
  ok(p.hasPage === true, 'страницы', `${p.id}: hasPage=${p.hasPage}; все проекты должны иметь страницу`);
  checkLinks(p.id, p.serviceLinks, 'project');
  for (const l of p.serviceLinks) if (l.evidence) ok(l.evidence.src.startsWith(`${p.snapshot}#`), 'связи', `${p.id}→${l.serviceId}: основание должно быть строкой снимка ${p.snapshot}`);
});
ok(projects.filter((p) => p.hasPage).length === 14, 'страницы', 'активны все 14 страниц проектов');

// главная: 6 проектов
ok(homeProjects?.ids.length === EXPECT.homeProjects, 'количество', `проектов главной ${homeProjects?.ids.length}, ожидалось ${EXPECT.homeProjects}`);
uniq(homeProjects.ids, 'проекты главной');
ok(homeProjects.status === 'TEMPORARY' && !!homeProjects.basis, 'поля', 'homeProjects: нужны status TEMPORARY (порядок не подтверждён, Q-21) и basis');
for (const id of homeProjects.ids) ok(projectIds.has(id), 'ссылки', `проекты главной: неизвестный проект «${id}»`);
{
  const row = specText.split('\n').find((l) => l.startsWith('| H-03'));
  ok(!!row, 'SPEC', 'в SPEC-DEMO.md нет строки H-03');
  let pos = -1;
  for (const id of homeProjects.ids) {
    const title = projects.find((p) => p.id === id)?.title.text ?? '';
    const at = row ? row.indexOf(SPEC_ALIAS[id] ?? title) : -1;
    ok(at > pos, 'SPEC', `проекты главной: «${title}» не найден в строке H-03 SPEC-DEMO.md в заданном порядке`);
    pos = Math.max(pos, at);
  }
}

// ---------- ТЛТ ----------
const { tlt } = tltM;
ok(projectIds.has(tlt?.projectId) && projects.find((p) => p.id === tlt.projectId)?.hasPage, 'ТЛТ', 'tlt.projectId должен указывать на проект со страницей');
ok(tlt.heading?.src.startsWith('tlt.md#rec596161305/') && tlt.facts?.length >= 1, 'ТЛТ', 'ТЛТ: заголовок и факты берутся из tlt.md');
ok(tlt.gallery.length === EXPECT.gallery && tlt.gallery.every((g) => g === null), 'ТЛТ', `ТЛТ: галерея — ${EXPECT.gallery} заглушек (null) до получения фото`);
ok(tlt.catalogHref === navM.routes?.projects, 'ТЛТ', 'ТЛТ: ссылка на каталог должна совпадать с маршрутом /projects');
ok(workTypes.length === EXPECT.workTypes, 'количество', `видов работ ТЛТ ${workTypes.length}, ожидалось ${EXPECT.workTypes}`);
seqIds(workTypes.map((w, i) => ({ id: w.id.replace('prj-14-', 'x-') })), 'x-', 'видов работ');
uniq(workTypes.map((w) => w.id), 'ID видов работ');
workTypes.forEach((w, i) => {
  req(w, ['id', 'title', 'snapshot', 'hasPage', 'serviceLinks'], `вид работ ${w.id}`);
  ok(w.id === `prj-14-${String(i + 1).padStart(2, '0')}` && w.title.src === `tlt.md#rec606966693/${2 * i + 1}`, 'порядок', `${w.id}: порядок видов работ отличается от источника tlt.md`);
  ok(w.hasPage === true, 'страницы', `${w.id}: страницы видов работ должны существовать`);
  ok(w.snapshot === `${i + 1}.md` && existsSync(join(sourceDir, w.snapshot)), 'снимок', `${w.id}: нет снимка страницы ${w.snapshot}`);
  if (existsSync(join(sourceDir, w.snapshot))) {
    const snap = (cache.get(w.snapshot) ?? (cache.set(w.snapshot, loadSnapshot(sourceDir, w.snapshot)), cache.get(w.snapshot)));
    const all = [...snap.blocks.values()].flat();
    const hit = all.some((u, k) => u.text === w.title.text || (all[k + 1] && `${u.text} ${all[k + 1].text}` === w.title.text));
    ok(hit, 'снимок', `${w.id}: название вида работ не найдено в ${w.snapshot} (страница-источник должна содержать то же название)`);
  }
  checkLinks(w.id, w.serviceLinks, 'work');
  for (const l of w.serviceLinks) if (l.evidence) ok(l.evidence.src.startsWith(`${w.snapshot}#`), 'связи', `${w.id}→${l.serviceId}: основание должно быть строкой снимка ${w.snapshot}`);
});
{
  const parent = projects.find((p) => p.id === tlt.projectId);
  const fromChildren = new Set(workTypes.flatMap((w) => w.serviceLinks.map((l) => l.serviceId)));
  const parentIds = new Set(parent.serviceLinks.map((l) => l.serviceId));
  ok([...fromChildren].sort().join() === [...parentIds].sort().join(), 'связи', `связи ТЛТ ${[...parentIds]} не равны объединению связей видов работ ${[...fromChildren]}`);
}

// сверка пар с матрицей IA §7.4
{
  const section = iaText.slice(iaText.indexOf('### 7.4'));
  const ia = new Set();
  const byStatus = {};
  for (const line of section.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length < 8 || !/^(PRJ-\d\d(-\d\d)?|—)$/.test(c[1])) continue;
    const status = c[c.length - 3].replace(/\*/g, '');
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    ok(c[c.length - 2] === 'нет', 'связи', `IA §7.4: у ${c[1]}→${c[3]} CLIENT_APPROVED не «нет» — данные требуют обновления`);
    if (status === 'SOURCE_SUPPORTED') ia.add(`${c[1].toLowerCase()}>${c[3].toLowerCase()}`);
  }
  // IA §7.4: «40 строк (SOURCE_SUPPORTED 8, PROPOSED 16, PENDING 16)»
  ok(byStatus.SOURCE_SUPPORTED === 8 && byStatus.PROPOSED === 16 && byStatus.PENDING === 16, 'IA', `в IA §7.4 ожидалось 8/16/16 строк SOURCE_SUPPORTED/PROPOSED/PENDING, найдено ${JSON.stringify(byStatus)}: матрица изменилась — обновить данные`);
  for (const p of pairs) ok(ia.has(p), 'связи', `связь ${p} есть в данных, но не SOURCE_SUPPORTED в IA §7.4`);
  for (const p of ia) ok(pairs.has(p), 'связи', `связь ${p} (SOURCE_SUPPORTED в IA §7.4) отсутствует в данных`);
}

// ---------- преимущества, компания ----------
const { advantages, homeAdvantageIds, advantagesHeading } = adv;
ok(advantages.length === EXPECT.advantages, 'количество', `преимуществ ${advantages.length}, ожидалось ${EXPECT.advantages}`);
seqIds(advantages, 'adv-', 'преимуществ');
advantages.forEach((a, i) => ok(a.title.src === `advantages.md#rec596853171/${i + 3}`, 'порядок', `${a.id}: порядок преимуществ отличается от источника`));
ok(advantagesHeading.src === 'advantages.md#rec596853171/1-2', 'поля', 'заголовок преимуществ: advantages.md#rec596853171/1-2');
ok(homeAdvantageIds.ids.length === EXPECT.homeAdvantages, 'количество', `преимуществ главной ${homeAdvantageIds.ids.length}, ожидалось ${EXPECT.homeAdvantages}`);
ok(homeAdvantageIds.status === 'TEMPORARY' && !!homeAdvantageIds.basis, 'поля', 'homeAdvantageIds: нужны status TEMPORARY (Q-26) и basis');
uniq(homeAdvantageIds.ids, 'преимущества главной');
for (const id of homeAdvantageIds.ids) ok(advantages.some((a) => a.id === id), 'ссылки', `преимущества главной: неизвестное «${id}»`);
ok(homeAdvantageIds.ids.join() === 'adv-01,adv-02,adv-03', 'SPEC', 'SPEC-DEMO §6.1 H-04: на главной первые три преимущества (P-17)');

const { departments, departmentsHeading, documents, company } = comp;
ok(departments.length === EXPECT.departments, 'количество', `отделов ${departments.length}, ожидалось ${EXPECT.departments}`);
seqIds(departments, 'dep-', 'отделов');
departments.forEach((d, i) => ok(d.title.src === `about.md#rec596030242/${i + 2}`, 'порядок', `${d.id}: порядок отделов отличается от источника`));
req(company, ['name', 'lead', 'descriptor'], 'company');
ok(documents.status === 'PENDING_FROM_CLIENT' && documents.items.length === 0, 'документы', 'documents: статус PENDING_FROM_CLIENT, элементов нет (СРО не публикуются, A-15)');

// ---------- контакты ----------
{
  const { phones, email, address } = cont;
  ok(phones.length === EXPECT.phones, 'количество', `телефонов ${phones.length}, ожидалось ${EXPECT.phones}`);
  uniq(phones.map((p) => p.id), 'ID телефонов');
  const contactsRaw = readLf(join(sourceDir, 'contacts.md'));
  for (const p of phones) {
    req(p, ['id', 'display', 'href', 'whatsapp', 'status'], `телефон ${p.id}`);
    const digits = p.display.text.replace(/\D/g, '');
    ok(/^7\d{10}$/.test(digits), 'контакты', `${p.id}: номер должен состоять из 11 цифр, начиная с 7`);
    ok(p.href === `tel:+${digits}`, 'контакты', `${p.id}: href должен быть tel:+${digits}, найдено «${p.href}»`);
    ok(p.whatsapp === `https://wa.me/${digits}` && contactsRaw.includes(`${p.whatsapp}?text=`), 'контакты', `${p.id}: WhatsApp-ссылка должна быть подтверждена contacts.md`);
    ok(p.status === 'PENDING_CLIENT_CONFIRMATION', 'контакты', `${p.id}: актуальность не подтверждена заказчиком, статус PENDING_CLIENT_CONFIRMATION`);
  }
  req(email, ['display', 'href', 'status'], 'email');
  ok(email.href === `mailto:${email.display.text}` && /^[^\s@]+@[^\s@]+\.[a-z]+$/.test(email.display.text), 'контакты', 'email: href должен быть mailto:<адрес> без лишнего префикса');
  ok(email.status === 'PENDING_CLIENT_CONFIRMATION', 'контакты', 'email: статус PENDING_CLIENT_CONFIRMATION');
  ok(Object.keys(address).join() === 'status' && address.status === 'ADDRESS_PENDING', 'контакты', 'address: только status ADDRESS_PENDING, текста адреса нет');
}

// ---------- политика ----------
{
  const total = loadSnapshot(sourceDir, 'privacy.md').blocks.get('rec596899666')?.length ?? 0;
  const p = priv.privacyParagraphs;
  ok(p.length === total - 1 && p.every((x, i) => x.src === `privacy.md#rec596899666/${i + 2}`), 'политика', `политика: ожидалось ${total - 1} абзацев в порядке источника, найдено ${p.length}`);
  ok(priv.privacyTitle.src === 'privacy.md#rec596899666/1', 'политика', 'заголовок политики: privacy.md#rec596899666/1');
}

// ---------- 6. ui.ts ----------
{
  const { ui, uiSources, uiSpec } = uiM;
  const leaves = [];
  (function collect(o, path) {
    for (const [k, v] of Object.entries(o)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === 'string') leaves.push([p, v]);
      else if (v && typeof v === 'object') collect(v, p);
    }
  })({ ...ui, pages: uiM.pageui ?? {} }, '');
  for (const [p, v] of leaves) {
    ok(v.trim().length > 0, 'ui', `ui.${p}: пустая подпись`);
    for (const m of MARKERS) ok(!v.includes(m), 'маркеры', `ui.${p}: внутренний маркер ${m} попал в интерфейсный текст`);
  }
  for (const [path, ref] of Object.entries(uiSources)) {
    const value = dig(ui, path);
    ok(typeof value === 'string', 'ui', `uiSources: нет подписи ui.${path}`);
    const r = resolve(ref, `ui.${path}`);
    checks++;
    if (r && typeof value === 'string' && r.text !== value) fail('дословность', `ui.${path} (${ref}): ${diagnose(value, r.text)}`);
  }
  for (const path of uiSpec) {
    const value = dig(ui, path);
    ok(typeof value === 'string' && specText.includes(`«${value}»`), 'SPEC', `ui.${path}: «${value}» не найдено в SPEC-DEMO.md в «ёлочках»`);
  }
  ok(ui.cta.consent.includes(ui.cta.consentLink), 'ui', 'ui.cta.consentLink должен входить в ui.cta.consent');
  const spec = new Set(uiSpec), src = new Set(Object.keys(uiSources));
  for (const k of spec) ok(!src.has(k), 'ui', `ui.${k}: подпись не может быть одновременно в uiSources и uiSpec`);
}

// ---------- 3. полнота ----------
let covered = 0;
let excluded = 0;
for (const [file, blocks] of Object.entries(COVERAGE)) {
  if (!cache.has(file)) cache.set(file, loadSnapshot(sourceDir, file));
  const snap = cache.get(file);
  for (const [block, units] of snap.blocks) {
    if (!units.length) continue;
    const rule = blocks[block];
    if (!ok(rule, 'полнота', `${file}#${block}: блок с текстом не учтён в COVERAGE — использовать в данных или исключить с причиной`)) continue;
    const usedSet = used.get(`${file}|${block}`) ?? new Set();
    const usedTexts = new Set(units.filter((u) => usedSet.has(u.n)).map((u) => u.text));
    for (const u of units) {
      const isUsed = usedSet.has(u.n);
      const reason = rule.all ?? rule.skip?.[u.n] ?? rule.skipText?.[u.text];
      if (reason) {
        excluded++;
        ok(!isUsed, 'полнота', `${file}#${block}/${u.n}: исключена («${reason}»), но используется в данных`);
      } else if (isUsed) covered++;
      else if (rule.dupOk && usedTexts.has(u.text)) covered++;
      else ok(false, 'полнота', `${file}#${block}/${u.n} [${u.label}] «${u.text.slice(0, 70)}»: оригинальный фрагмент пропущен в данных`);
    }
  }
  for (const block of Object.keys(blocks)) ok(snap.blocks.has(block), 'полнота', `COVERAGE: в ${file} нет блока ${block}`);
}

// Полная версия: каждый новый снимок покрыт дословным текстом или общим каноническим фрагментом.
const detailitems = detailsM.projectdetails ?? [];
const workitems = worksM.workdetails ?? [];
const groups = vacanciesM.vacancygroups ?? [];
ok(detailitems.length === 13, 'количество', 'ожидались 13 подробных страниц проектов и отдельная ТЛТ');
ok(workitems.length === 12, 'количество', 'ожидались 12 подробных страниц видов работ ТЛТ');
uniq(workitems.map(w => w.slug), 'slug видов работ');
for(const detail of detailitems) {
  ok(projectIds.has(detail.id) && !!detail.heading?.text, 'страницы', 'страница проекта должна иметь ID и исходный заголовок');
}
for(const work of workitems) {
  ok(workTypeIds.has(work.id) && work.paragraphs.length > 0, 'страницы', 'вид работ должен иметь ID и описание');
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(work.slug), 'slug', 'неверный slug вида работ');
}
ok(groups.length === 2 && groups.flatMap(g => g.vacancies).length === 3, 'количество', 'ожидались 2 группы и 3 вакансии');
ok(groups.flatMap(g=>g.vacancies).every(v=>v.active === false), 'вакансии', 'актуальность вакансий не подтверждена: active=false');
const fullsnapshots = [...projects.filter(p=>p.slug !== 'tlt').map(p=>p.snapshot), ...workTypes.map(w=>w.snapshot), 'worker.md', 'engineers.md', 'vacancies.md'];
for (const file of fullsnapshots) {
  if(!file || !existsSync(join(sourceDir,file))) continue;
  const record = file === 'vacancies.md' ? vacanciesM : file === 'worker.md' ? groups[0] : file === 'engineers.md' ? groups[1] : detailitems.find(d=>d.src===file) ?? workitems.find(w=>w.src===file);
  const localvalues = new Set();
  (function collect(value) { if(!value || typeof value !== 'object') return; if(typeof value.text==='string' && typeof value.src==='string') { localvalues.add(value.text); return; } for(const child of Object.values(value)) collect(child); })(record);
  const snapshot = loadSnapshot(sourceDir,file);
  for(const [block,units] of snapshot.blocks) {
    const joinedheading = units.filter(u=>u.label==='TITLE').map(u=>u.text).join(' ');
    for(const unit of units) {
      if(unit.text==='Подробнее') { excluded++; continue; }
      const present = localvalues.has(unit.text) || (unit.label==='TITLE' && localvalues.has(joinedheading));
      ok(present,'полнота',file+'#'+block+'/'+unit.n+': оригинальный фрагмент пропущен в данных');
      if(present) covered++;
    }
  }
}

// ---------- 7. запреты: старый адрес, старый сайт, новости, маркеры в сборке ----------
{
  const contactsUnits = loadSnapshot(sourceDir, 'contacts.md').blocks.get('rec596804757') ?? [];
  const oldAddress = [contactsUnits[4]?.text, contactsUnits[5]?.text, 'Кириллова', 'ул. Александра', 'д. 53/2'].filter(Boolean);
  ok(oldAddress.length >= 5, 'адрес', 'не удалось прочитать старый адрес из contacts.md для проверки отсутствия');
  const scan = [];
  const srcDir = join(root, 'src');
  for (const f of walkFiles(srcDir)) if (['.ts', '.astro', '.css', '.md', '.json'].includes(extname(f))) scan.push(f);
  const dist = join(root, 'dist');
  if (existsSync(dist)) for (const f of walkFiles(dist)) if (extname(f) === '.html') scan.push(f);
  for (const f of scan) {
    const rel = relative(root, f).replace(/\\/g, '/');
    const text = readLf(f);
    const linktext = rel.startsWith('dist/') ? text.replace(/data-site-origin=["'][^"']*["']/gi, '').replace(/<(?:link|meta)\b[^>]*>/gi, '').replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '') : text;
    for (const a of oldAddress) ok(!text.includes(a), 'старый адрес', `${rel}: найден фрагмент старого адреса «${a}» (должно быть ADDRESS_PENDING)`);
    if (rel.startsWith('dist/') && rel.endsWith('.html')) for (const m of MARKERS) ok(!text.includes(m), 'маркеры', `${rel}: внутренний маркер ${m} в собранной странице`);
    if (rel !== 'src/data/source/privacy.ts') {
      for (const m of linktext.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
        if (/^https:\/\/(?:wa\.me\/|www\.w3\.org\/)/.test(m[0]) && !/tilda/.test(m[0])) continue;
        if (m[0].replaceAll('&amp;', '&') === 'https://blagoveschensk.hh.ru/employer/9992331?hhtmFrom=vacancy&tab=VACANCIES') continue; // «Вакансии» в подвале — решение владельца 2026-11-18
        if (rel === 'src/pages/sitemap.xml.ts' && m[0] === 'http://www.sitemaps.org/schemas/sitemap/0.9') continue;
        if (rel === 'src/data/site-config.ts' && m[0] === 'https://ses-dv.ru') continue;
        if (rel === 'src/components/seo-head.astro' && m[0] === 'https://schema.org') continue;
        if (rel === 'src/scripts/analytics.ts' && m[0] === 'https://mc.yandex.ru/metrika/tag.js') continue;
        fail('старый сайт', `${rel}: внешняя ссылка «${m[0]}»; допустимы только wa.me (SPEC-DEMO §7), адреса сайта — лишь в тексте политики`);
      }
    }
  }
  ok(!existsSync(join(root, 'src/data/source/news.ts')) && !Object.keys(await load('index.ts')).some((k) => /news/i.test(k)), 'новости', 'данные новостей не создаются: публикаций нет (A-13)');
}

// ---------- итог ----------
function finish() {
  if (errors.length) {
    console.error(`check-copy: ОШИБКИ (${errors.length})`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
}
finish();
console.log(
  `check-copy: OK — проверок ${checks}; SourceText ${sourceTexts} (+ ${decisionTexts} по решению A-18); ` +
    `услуг ${services.length}, проектов ${projects.length} (на главной ${homeProjects.ids.length}, страницы у всех), видов работ ТЛТ ${workTypes.length}, ` +
    `преимуществ ${advantages.length} (на главной ${homeAdvantageIds.ids.length}), отделов ${departments.length}, абзацев политики ${priv.privacyParagraphs.length}; ` +
    `строк источника: использовано ${covered}, исключено с причиной ${excluded}`,
);

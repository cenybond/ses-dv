// Каталог проектов: 14 карточек в порядке источника docs/content/source/completed-projects.md (PRJ-01…PRJ-14).
// PRJ-15 («Перенос модульной котельной…», /page55167833.html) в каталоге источника отсутствует и в демо не показывается (A-19, REVIEW).
// Нет года, заказчика, стоимости, статуса, сроков — их нет в источнике. `image: null` — фото ожидаются от заказчика (A-06), показывается заглушка.
// `slug` предложен в IA §6.2 и не утверждён. Страница есть только у ТЛТ (A-24): `hasPage` управляет тем, станет ли карточка ссылкой.
// `serviceLinks` — только SOURCE_SUPPORTED из IA §7.4 (PROPOSED и PENDING в данные демо не переносятся); `clientApproved: false` у всех (A-20).
// Каждая связь держится на строке снимка страницы проекта (`evidence`); у ТЛТ связь выводится из видов работ (tlt.ts).
import type { Project, SourceText } from '../types.ts';

export const projectsPageTitle: SourceText = { text: 'ПРОЕКТЫ', src: 'completed-projects.md#rec596873402/1' };
export const projectsPageLead: SourceText = { text: 'В данном разделе указаны завершенные и текущие проекты', src: 'completed-projects.md#rec596873402/2' };

export const projects = [
  {
    id: 'prj-01',
    slug: 'hope',
    title: { text: 'Санаторий-профилакторий "Надежда"', src: 'completed-projects.md#rec596873316/1' },
    snapshot: 'hope.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-02',
    slug: 'hc',
    title: { text: 'ДК Железнодорожников', src: 'completed-projects.md#rec596873316/2' },
    snapshot: 'hc.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-03',
    slug: 'residential-complex',
    title: { text: 'Жилой комплекс «Северный жилой район»', src: 'completed-projects.md#rec596873316/3' },
    snapshot: 'residential-complex.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-04',
    slug: 'clap',
    title: { text: 'Строительство КЛЭП-10кВ от РУ-10кВ ТП-27А до РУ-10кВ ТП-31 в рамках Технологического присоединения энергопринимающих устройств для Сохранения объекта культурного наследия', src: 'completed-projects.md#rec596873316/4' },
    snapshot: 'clap.md',
    image: null,
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-02', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Строительство КЛЭП-10кВ от РУ-10кВ ТП-27А до РУ-10кВ ТП-31 в рамках Технологического присоединения энергопринимающих устройств для cохранения объекта культурного наследия', src: 'clap.md#rec801643268/1' } },
    ],
  },
  {
    id: 'prj-05',
    slug: 'pumping-station',
    title: { text: 'Капитальный ремонт канализационной насосной станции в квартале 374 г. Благовещенска', src: 'completed-projects.md#rec596873316/5' },
    snapshot: 'pumping-station.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-06',
    slug: 'ktp',
    title: { text: 'Реконструкция трансформаторных подстанций КТП № 195 и КТП № 479', src: 'completed-projects.md#rec596873316/6' },
    snapshot: 'ktp.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-07',
    slug: 'akik',
    title: { text: 'ГПОБУ АО "АКИК"', src: 'completed-projects.md#rec596873316/7' },
    snapshot: 'akik.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-08',
    slug: 'chp',
    title: { text: 'Благовещенская ТЭЦ', src: 'completed-projects.md#rec596873316/8' },
    snapshot: 'chp.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-09',
    slug: 'philharmonic',
    title: { text: 'ГАУКАО «Амурская областная филармония»', src: 'completed-projects.md#rec596873316/9' },
    snapshot: 'philharmonic.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-10',
    slug: 'tp-10',
    title: { text: 'Строительство ТП-10/0,4 кВ, ВЛЗ-10 кВ, ЛЭП-0,4 кВ', src: 'completed-projects.md#rec596873316/10' },
    snapshot: 'tp-10.md',
    image: null,
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-02', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Строительство ТП-10/0,4 кВ, ВЛЗ-10 кВ, ЛЭП-0,4 кВ', src: 'tp-10.md#rec659904251/1' } },
    ],
  },
  {
    id: 'prj-11',
    slug: 'smr-kalinina',
    title: { text: 'Строительно-монтажные работы по\u00A0замене участка водопроводной сети по\u00A0ул.\u00A0Калинина между ул.\u00A0Игнатьевское шоссе и\u00A0ул.\u00A0Воронкова', src: 'completed-projects.md#rec596873316/11' },
    snapshot: 'smr-kalinina.md',
    image: null,
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-12',
    slug: 'pns',
    title: { text: 'Строительство ПНС в\u00A0ЗПУ-А1, район Молокозавода с\u00A0реконструкцией водовода для дома по\u00A0ул.\u00A0Мичурина 15', src: 'completed-projects.md#rec596873316/12' },
    snapshot: 'pns.md',
    image: null,
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-04', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Устройство видеонаблюдения, пожарной и\u00A0охранной сигнализации;', src: 'pns.md#rec659889680/9' } },
    ],
  },
  {
    id: 'prj-13',
    slug: 'aks',
    title: { text: 'Выполнение строительно — монтажных работ по реконструкции кабельных линий для нужд ООО «Амурские коммунальные системы»', src: 'completed-projects.md#rec596873316/13' },
    snapshot: 'aks.md',
    image: null,
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-05', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Вопреки всех законов ГНБ, выполнены работы по\u00A0прокладке двухстенной гофрированной трубы 110\u00A0мм. под паркингом административного здания расположенного по\u00A0ул.\u00A0Амурская, д.\u00A0111. Длина прокола 50 метров.', src: 'aks.md#rec632910872/2' } },
    ],
  },
  {
    id: 'prj-14',
    slug: 'tlt',
    title: { text: 'Таможенно-логистический терминал', src: 'completed-projects.md#rec596873316/14' },
    snapshot: 'tlt.md',
    image: null,
    hasPage: true,
    serviceLinks: [
      { serviceId: 's-04', basis: 'SOURCE_SUPPORTED', clientApproved: false, derivedFrom: ['prj-14-08'] },
      { serviceId: 's-05', basis: 'SOURCE_SUPPORTED', clientApproved: false, derivedFrom: ['prj-14-01'] },
    ],
  },
] as const satisfies readonly Project[];

export type ProjectId = (typeof projects)[number]['id'];

/**
 * Проекты главной (H-03) задаются отдельно от каталога. Состав и порядок ВРЕМЕННЫЕ: взяты из SPEC-DEMO §6.1 (H-03),
 * подтверждённого порядка нет (Q-21). `check-copy` сверяет названия с текстом SPEC-DEMO.
 */
export const homeProjects = {
  status: 'TEMPORARY',
  basis: 'SPEC-DEMO.md §6.1 H-03; DECISIONS.md Q-21',
  ids: ['prj-14', 'prj-08', 'prj-01', 'prj-02', 'prj-09', 'prj-03'],
} as const satisfies { status: 'TEMPORARY'; basis: string; ids: readonly ProjectId[] };

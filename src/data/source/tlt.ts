// Проект «Таможенно-логистический терминал» (PRJ-14, /projects/tlt). Тексты — docs/content/source/tlt.md дословно.
// Название карточки каталога — в projects.ts (одна запись, без дубля); связанные услуги — `serviceLinks` проекта prj-14 (SOURCE_SUPPORTED, не CLIENT_APPROVED).
// 12 видов работ — данные страницы ТЛТ, не отдельные страницы (A-24): в интерфейсе не ссылки, «Подробнее» не выводится.
import type { SourceText, WorkType } from '../types.ts';
import { routes } from '../nav.ts';

export const tlt = {
  projectId: 'prj-14',
  /** Заголовок страницы (H1): название объекта и его адрес — адрес объекта, не компании. */
  heading: { text: '"Таможенно-логистический терминал" (ТЛТ), расположенный по адресу: Амурская область, Благовещенский район, в районе села Каникурган, Гродековского сельсовета', src: 'tlt.md#rec596161305/1' } satisfies SourceText,
  /** Единственная подтверждённая источником характеристика. Других нет: годов, заказчика, сроков в источнике нет. */
  facts: [{ id: 'works-total-cost', text: { text: 'Общая стоимость выполненных на объекте работ составила более 60 млн.руб.', src: 'tlt.md#rec596161305/2' } satisfies SourceText }],
  /** Шесть слотов галереи; `null` — заглушка до получения фото (A-06). */
  gallery: [null, null, null, null, null, null],
  catalogHref: routes.projects,
} as const;

export const tltWorkTypes = [
  {
    id: 'prj-14-01',
    title: { text: 'ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и напорной канализации', src: 'tlt.md#rec606966693/1' },
    snapshot: '1.md',
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-05', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и напорной канализации', src: '1.md#rec606973027/1' } },
    ],
  },
  {
    id: 'prj-14-02',
    title: { text: 'Наружное электроснабжение', src: 'tlt.md#rec606966693/3' },
    snapshot: '2.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-03',
    title: { text: 'Наружное электроосвещение', src: 'tlt.md#rec606966693/5' },
    snapshot: '3.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-04',
    title: { text: 'Сборка и пусконаладка модульной БКТП', src: 'tlt.md#rec606966693/7' },
    snapshot: '4.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-05',
    title: { text: 'Внутреннее электроснабжение в здании АБК с КПП', src: 'tlt.md#rec606966693/9' },
    snapshot: '5.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-06',
    title: { text: 'Внутреннее электроснабжение в зданиях Перетарочных коплексов', src: 'tlt.md#rec606966693/11' },
    snapshot: '6.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-07',
    title: { text: 'Наружные сети связи', src: 'tlt.md#rec606966693/13' },
    snapshot: '7.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-08',
    title: { text: 'Внутриплощадочное видеонаблюдение', src: 'tlt.md#rec606966693/15' },
    snapshot: '8.md',
    hasPage: false,
    serviceLinks: [
      { serviceId: 's-04', basis: 'SOURCE_SUPPORTED', clientApproved: false, evidence: { text: 'Прокладка электрических кабелей, кабелей связи, монтаж камер видеонаблюдения, монтаж телекоммуникационных шкафов', src: '8.md#rec606977655/2' } },
    ],
  },
  {
    id: 'prj-14-09',
    title: { text: 'Внеплощадочные (наружные) сети тепло и водоснабжения, напорной канализации', src: 'tlt.md#rec606966693/17' },
    snapshot: '9.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-10',
    title: { text: 'Электрообогрев внеплощадочных (наружных) сетей водоснабжения, напорной канализации', src: 'tlt.md#rec606966693/19' },
    snapshot: '10.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-11',
    title: { text: 'Заземления мобильной АЗС', src: 'tlt.md#rec606966693/21' },
    snapshot: '11.md',
    hasPage: false,
    serviceLinks: [],
  },
  {
    id: 'prj-14-12',
    title: { text: 'Сварка и монтаж несущей фермы дымохода газовой котельной', src: 'tlt.md#rec606966693/23' },
    snapshot: '12.md',
    hasPage: false,
    serviceLinks: [],
  },
] as const satisfies readonly WorkType[];

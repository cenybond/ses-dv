// Компания: название, описания, строки hero, отделы. Тексты дословно из docs/content/source/ (about.md, home.md).
// Не включены (решения заказчика): членство в СРО и сканы допусков (A-15, Q-20), «Наши заказчики» (Q-10), «Новости» (A-13), ИНН/ОГРН (Q-15), адрес (ADDRESS_PENDING).
import type { Department, SourceText } from '../types.ts';

/** Краткая характеристика: строка hero главной и подвал (одна запись, без дубля). */
const descriptor: SourceText = { text: 'Многопрофильная строительно-монтажная организация', src: 'home.md#rec651850071/4' };

export const company = {
  /** Название на странице «О компании» (H1). */
  name: { text: 'ООО\u00A0«Связь Энергострой»', src: 'about.md#rec595315447/2' } satisfies SourceText,
  /** Лид «О компании» (строчная первая буква — как в источнике). */
  lead: { text: 'многопрофильная строительно-монтажная организация, осуществляющая комплекс работ по\u00A0проектированию и\u00A0строительству инженерных сетей, строительству промышленных, гражданских зданий и\u00A0других сооружений', src: 'about.md#rec595315447/1' } satisfies SourceText,
  descriptor,
} as const;

/** Строки hero главной (H-01) в порядке SPEC-DEMO §6.1. Фон — заглушка, фото в hero нет. */
export const hero = {
  intro: { text: 'Осуществляем комплекс работ:', src: 'home.md#rec651850071/1' },
  title: { text: 'Связь Энергострой', src: 'home.md#rec651850071/2' },
  lines: [
    { text: 'Проектирование и\u00A0строительство инженерных сетей', src: 'home.md#rec651850071/3' },
    descriptor,
    { text: 'Строительство промышленных, гражданских зданий и\u00A0других сооружений', src: 'home.md#rec651850071/5' },
  ],
} as const;

/** «В НАШЕЙ КОМПАНИИ ОРГАНИЗОВАНЫ» + пять отделов. Актуальность не подтверждена (Q-20); фото отделов в источнике стоковые и не используются. */
export const departmentsHeading: SourceText = { text: 'В НАШЕЙ КОМПАНИИ ОРГАНИЗОВАНЫ', src: 'about.md#rec596030242/1' };

export const departments = [
  { id: 'dep-01', title: { text: 'Производственно-технический отдел', src: 'about.md#rec596030242/2' } },
  { id: 'dep-02', title: { text: 'Геодезическая служба', src: 'about.md#rec596030242/3' } },
  { id: 'dep-03', title: { text: 'Сметно-договорной отдел', src: 'about.md#rec596030242/4' } },
  { id: 'dep-04', title: { text: 'Бухгалтерия', src: 'about.md#rec596030242/5' } },
  { id: 'dep-05', title: { text: 'Отдел по работе с персоналом', src: 'about.md#rec596030242/6' } },
] as const satisfies readonly Department[];

/** Место для документов и допусков: актуальные документы ожидаются от заказчика, СРО и сканы не показываются (A-15). */
export const documents = {
  status: 'PENDING_FROM_CLIENT',
  items: [],
} as const;

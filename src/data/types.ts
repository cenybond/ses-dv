// Типы слоя данных демо (DEMO-03). Тексты делятся на три класса (ARCHITECTURE-DEMO §3, SPEC-DEMO §10):
//   S — исходный контент компании (`data/source/*`): дословно из docs/content/source/, каждая строка имеет ссылку на снимок;
//   U — подписи интерфейса (`data/ui.ts`): авторские, на согласование;
//   M — заглушки и маркеры ожидания данных: статусы в данных (`*_PENDING`), пользователю не показываются.

/**
 * Ссылка на строку исходного снимка в docs/content/source/ (разбор — scripts/lib/snapshots.mjs):
 *   'файл.md#recNNN/N'    единица N блока recNNN;
 *   'файл.md#recNNN/N-M'  единицы N…M подряд одной метки, склеенные одним пробелом;
 *   'файл.md#quote:Текст' текст в «ёлочках» вне блоков (подписи полей формы);
 *   'файл.md#cell:Текст'  ячейка таблицы снимка.
 */
export type SourceRef = string;

/** S: текст из снимка. `check-copy` сверяет `text` с `src` побайтно. */
export interface SourceText {
  readonly text: string;
  readonly src: SourceRef;
}

/** Текст, добавленный заказчиком решением из DECISIONS.md; в снимках его нет (A-18: «Проектирование»). */
export interface DecisionText {
  readonly text: string;
  readonly decision: string;
}

export interface ImageAsset {
  readonly src: string;
  readonly alt: string;
}

/** NONE_IN_SOURCE — описания нет на действующем сайте; DESCRIPTION_PENDING — описание ожидается от заказчика. */
export type DescriptionStatus = 'NONE_IN_SOURCE' | 'DESCRIPTION_PENDING';

/** Основание связи услуга ↔ проект (IA §7.3, A-20). Без CLIENT_APPROVED связь не считается утверждённой. */
export type LinkBasis = 'SOURCE_SUPPORTED' | 'PROPOSED' | 'PENDING';

export interface ServiceLink {
  readonly serviceId: string;
  readonly basis: LinkBasis;
  /** CLIENT_APPROVED получено от заказчика (A-20). Сейчас нигде не получено. */
  readonly clientApproved: boolean;
  /** Строка снимка страницы проекта, на которой держится связь (цитата, сверяется с источником). */
  readonly evidence?: SourceText;
  /** Связь родителя выводится из связей дочерних видов работ (ТЛТ). */
  readonly derivedFrom?: readonly string[];
}

export interface Service {
  readonly id: string;
  readonly title: SourceText | DecisionText;
  /** Описаний нет ни у одной из услуг (в снимке только названия). */
  readonly description: null;
  readonly descriptionStatus: DescriptionStatus;
}

export interface Project {
  readonly id: string;
  /** Предлагаемый slug (IA §6.2); не утверждён, A-24. */
  readonly slug: string;
  readonly title: SourceText;
  /** Файл снимка страницы проекта в docs/content/source/. */
  readonly snapshot: string;
  /** Путь к изображению или null: до получения фото — заглушка (A-06). */
  readonly image: ImageAsset | null;
  /** У проекта есть своё окно на главной (отдельных страниц проектов нет, решение владельца 2026-11-18). */
  readonly hasPage: boolean;
  readonly serviceLinks: readonly ServiceLink[];
}

export interface WorkType {
  readonly id: string;
  readonly title: SourceText;
  /** Снимок отдельной страницы вида работ (не реализуется в демо, A-24). */
  readonly snapshot: string;
  readonly hasPage: boolean;
  readonly serviceLinks: readonly ServiceLink[];
}

export interface Advantage {
  readonly id: string;
  readonly title: SourceText;
}

export interface Department {
  readonly id: string;
  readonly title: SourceText;
}

/** Актуальность контактов заказчиком не подтверждена (A-07, Q-29). */
export type ConfirmationStatus = 'PENDING_CLIENT_CONFIRMATION' | 'CONFIRMED_BY_CLIENT';

export interface Phone {
  readonly id: string;
  readonly display: SourceText;
  readonly href: string;
  /** Ссылка wa.me, присутствующая в снимке (без предзаполненного текста про старый сайт). */
  readonly whatsapp: string;
  readonly status: ConfirmationStatus;
}

export interface Email {
  readonly display: SourceText;
  readonly href: string;
  readonly status: ConfirmationStatus;
}

/** Содержимое страницы проекта. Фрагменты — только дословные источники. */
export interface ProjectDetail {
  readonly id: string;
  readonly heading: SourceText;
  readonly sections: readonly {readonly id: string; readonly heading?: SourceText; readonly paragraphs: readonly SourceText[]}[];
  readonly galleries: readonly {readonly id: string; readonly title: SourceText}[];
  readonly src: string;
}

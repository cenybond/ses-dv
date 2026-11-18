// Услуги (S-01…S-10). S-01…S-09 — названия дословно из docs/content/source/services.md, в порядке источника.
// S-10 «Проектирование» добавлена заказчиком (DECISIONS.md A-18): в снимках её нет, описание ожидается от заказчика —
// `descriptionStatus: 'DESCRIPTION_PENDING'`, текст не придумывается. Описаний нет и у S-01…S-09: на действующем сайте только названия.
// Идентификаторы s-NN были якорями страницы /services (SPEC-DEMO §6.2); страницу удалил владелец 2026-11-18, перечень показывает окно в разделе «Наши услуги» на главной. Отдельных страниц услуг нет (B-13).
import type { Service, SourceText } from '../types.ts';

export const servicesPageTitle: SourceText = { text: 'УСЛУГИ', src: 'services.md#rec596139915/1' };

export const services = [
  { id: 's-01', title: { text: 'Строительство линейных сооружений магистральных и внутризоновых кабельных и воздушных линий связи', src: 'services.md#rec596139915/2' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-02', title: { text: 'Строительство электрических сетей и силового оборудования номиналом 0,4/10/35кВ', src: 'services.md#rec596139915/4' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-03', title: { text: 'Монтаж структурированных кабельных систем в административных и промышленных зданиях и сооружениях', src: 'services.md#rec596139915/6' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-04', title: { text: 'Монтаж объектов видеонаблюдения', src: 'services.md#rec596139915/8' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-05', title: { text: 'Монтаж инженерных коммуникаций, в том числе бестраншейным способом (методом ГНБ)', src: 'services.md#rec596139915/10-11' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-06', title: { text: 'Геодезическое сопровождение строительства', src: 'services.md#rec596139915/13' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-07', title: { text: 'Выполнение комплекса СМР при строительстве многоквартирных жилых домов', src: 'services.md#rec596139915/15' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-08', title: { text: 'Благоустройство дворовых и общественных территорий', src: 'services.md#rec596139915/17' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-09', title: { text: 'Обслуживание электрооборудования, электрических сетей и освещения', src: 'services.md#rec596139915/19' }, description: null, descriptionStatus: 'NONE_IN_SOURCE' },
  { id: 's-10', title: { text: 'Проектирование', decision: 'A-18' }, description: null, descriptionStatus: 'DESCRIPTION_PENDING' },
] as const satisfies readonly Service[];

export type ServiceId = (typeof services)[number]['id'];

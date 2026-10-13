// Преимущества компании: пять пунктов дословно из docs/content/source/advantages.md (A-21). Копий нет: страница «О компании»
// выводит все пять, главная — выборку по `homeAdvantageIds` (первые три, P-17; подтверждения нет, Q-26).
import type { Advantage, SourceText } from '../types.ts';

/** «ПОЧЕМУ СТОИТ ВЫБРАТЬ» + «ООО «Связь Энергострой»»: два заголовка источника, склеенные пробелом. */
export const advantagesHeading: SourceText = { text: 'ПОЧЕМУ СТОИТ ВЫБРАТЬ ООО «Связь Энергострой»', src: 'advantages.md#rec596853171/1-2' };

export const advantages = [
  { id: 'adv-01', title: { text: 'Высококвалифицированные специалисты', src: 'advantages.md#rec596853171/3' } },
  { id: 'adv-02', title: { text: 'Опыт работы на крупных объектах', src: 'advantages.md#rec596853171/4' } },
  { id: 'adv-03', title: { text: 'Работаем по Локально-Сметным Расчетам', src: 'advantages.md#rec596853171/5' } },
  { id: 'adv-04', title: { text: 'При необходимости предоставляем банковскую гарантию на аванс', src: 'advantages.md#rec596853171/6' } },
  { id: 'adv-05', title: { text: 'Оплата любым удобным способом', src: 'advantages.md#rec596853171/7' } },
] as const satisfies readonly Advantage[];

export type AdvantageId = (typeof advantages)[number]['id'];

export const homeAdvantageIds = {
  status: 'TEMPORARY',
  basis: 'SPEC-DEMO.md §6.1 H-04; DECISIONS.md P-17, Q-26',
  ids: ['adv-01', 'adv-02', 'adv-03'],
} as const satisfies { status: 'TEMPORARY'; basis: string; ids: readonly AdvantageId[] };

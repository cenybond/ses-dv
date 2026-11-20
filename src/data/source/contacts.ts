// Контакты: значения из docs/content/source/contacts.md; статус — актуальность заказчиком не подтверждена (A-07, Q-29).
// Форматы ссылок приведены к рабочим: tel:+7… (в источнике встречаются `tel:8…` и `tel:+7 924 …` с пробелами),
// `mailto:` без лишнего префикса «e-mail:» (в шапке источника он ошибочный), wa.me без предзаполненного текста про старый сайт.
// Номера WhatsApp взяты из ссылок wa.me снимка contacts.md; `check-copy` сверяет их с источником.
// Адрес: новый, назвал владелец 2026-11-20 (PROD-23). Старый адрес (contacts.md, блок rec596804757, строки 5–6) в данные НЕ переносится (check-copy это проверяет).
// ИНН и ОГРН в данных нет: подтверждения заказчика нет (Q-15).
import type { Email, Phone, SourceText } from '../types.ts';

export const contactsPageTitle: SourceText = { text: 'КОНТАКТЫ', src: 'contacts.md#rec596870778/1' };
/** Фраза с опечаткой источника («приезжаейте»): не правится без согласования (Q-24). */
export const contactsLead: SourceText = { text: 'Звоните, пишите или приезжаейте, мы всегда рады новым знакомствам!', src: 'contacts.md#rec596804757/1' };

export const phones = [
  {
    id: 'phone-1',
    display: { text: '+7 (924) 499-94-44', src: 'contacts.md#rec596804757/2' },
    href: 'tel:+79244999444',
    whatsapp: 'https://wa.me/79244999444',
    status: 'PENDING_CLIENT_CONFIRMATION',
  },
  {
    id: 'phone-2',
    display: { text: '+7 (924) 448-08-59', src: 'contacts.md#rec596804757/3' },
    href: 'tel:+79244480859',
    whatsapp: 'https://wa.me/79244480859',
    status: 'PENDING_CLIENT_CONFIRMATION',
  },
] as const satisfies readonly Phone[];

export const email = {
  display: { text: 'doc@ses-dv.ru', src: 'contacts.md#rec596804757/4' },
  href: 'mailto:doc@ses-dv.ru',
  status: 'PENDING_CLIENT_CONFIRMATION',
} as const satisfies Email;

/** Новый адрес офиса (поручение владельца 2026-11-20). Координаты дома 19В по OpenStreetMap (way 201514880); сверить на карте перед запуском. */
export const address = {
  line: { text: 'ул. Нагорная, 19в/9, офис, 2 этаж, г. Благовещенск, Амурская область', decision: 'PROD-23' },
  lat: 50.281787,
  lon: 127.486127,
  /** Ссылка на точку в 2ГИС (адрес в блоке контактов — обычная ссылка, без встраивания). */
  href: 'https://2gis.ru/blagoveshchensk?m=127.486127%2C50.281787%2F17',
  status: 'CLIENT_APPROVED',
} as const;

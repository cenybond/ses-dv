// Пустые реестры: новые публичные страницы появляются только после согласования материала и прав.
export type publication_status = 'draft' | 'approved';
export interface publication_source { reference: string; approved_by: string; approved_on: string; }
export interface publication_rights { status: 'pending' | 'approved'; holder: string; evidence: string; }
export interface publication_asset { src: string; mime: string; bytes: number; sha256: string; rights: publication_rights; }
export interface publication_image extends publication_asset { alt: string; width: number; height: number; }
export interface news_entry {
  slug: string; status: publication_status; title: string; summary: string;
  published_on: string; paragraphs: readonly string[]; source: publication_source;
  rights: publication_rights; image?: publication_image;
}
export interface document_entry {
  slug: string; status: publication_status; title: string; description: string;
  published_on: string; valid_from: string; valid_until: string | null;
  source: publication_source; rights: publication_rights; asset: publication_asset;
  accessible_text: readonly string[];
}
export interface publications { news: readonly news_entry[]; documents: readonly document_entry[]; }

export const news: readonly news_entry[] = [];
export const documents: readonly document_entry[] = [];
const is_text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const is_date = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const valid_rights = (rights: publication_rights | undefined) => rights?.status === 'approved' && is_text(rights.holder) && is_text(rights.evidence);

export function validate_publications(input: publications, today = new Date().toISOString().slice(0, 10)): string[] {
  const errors: string[] = [];
  for (const kind of ['news', 'documents'] as const) {
    const slugs = new Set<string>();
    for (const entry of input[kind]) {
      const label = kind + '/' + entry.slug;
      const error = (reason: string) => errors.push(label + ': ' + reason);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || entry.slug.length > 100) error('недопустимый slug');
      if (slugs.has(entry.slug)) error('повтор slug');
      slugs.add(entry.slug);
      if (!['draft', 'approved'].includes(entry.status)) error('неизвестный статус');
      if (entry.status !== 'approved') continue;
      if (!is_text(entry.title) || entry.title.length > 250) error('нужен проверенный заголовок до 250 знаков');
      if (!is_date(entry.published_on) || entry.published_on > today) error('некорректная или будущая дата публикации');
      if (!entry.source || !is_text(entry.source.reference) || !is_text(entry.source.approved_by) || !is_date(entry.source.approved_on) || entry.source.approved_on > today) error('нет подтверждённого источника и даты согласования');
      if (!valid_rights(entry.rights)) error('права на публикацию не подтверждены');
      const asset = kind === 'news' ? (entry as news_entry).image : (entry as document_entry).asset;
      if (kind === 'documents' && !asset) error('файл документа отсутствует');
      if (asset) {
        const path = kind === 'news' ? /^\/media\/news\/[a-z0-9][a-z0-9/-]*\.(?:webp|avif|png|jpe?g)$/ : /^\/media\/documents\/[a-z0-9][a-z0-9/-]*\.pdf$/;
        if (!path.test(asset.src) || asset.src.includes('//')) error('asset должен быть локальным безопасным путём /media/' + kind + '/');
        if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 20 * 1024 * 1024) error('некорректный размер файла (максимум 20 МБ)');
        if (!/^[a-f0-9]{64}$/.test(asset.sha256)) error('нужен SHA-256 файла');
        if (!valid_rights(asset.rights)) error('права на файл не подтверждены');
        const extension = asset.src.split('.').at(-1);
        const mimes: Record<string, string> = { webp: 'image/webp', avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
        if (asset.mime !== mimes[extension || '']) error('MIME не соответствует расширению');
        if (kind === 'news') {
          const image = asset as publication_image;
          if (!is_text(image.alt) || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width < 1 || image.height < 1) error('у изображения нужны alt и размеры');
        }
      }
      if (kind === 'news') {
        const item = entry as news_entry;
        if (!is_text(item.summary) || !Array.isArray(item.paragraphs) || !item.paragraphs.length || item.paragraphs.some((text) => !is_text(text))) error('нужны краткое описание и содержательные абзацы');
      } else {
        const item = entry as document_entry;
        if (!is_text(item.description) || !Array.isArray(item.accessible_text) || !item.accessible_text.length || item.accessible_text.some((text) => !is_text(text))) error('нужны описание и доступный текст документа');
        if (!is_date(item.valid_from) || item.valid_from > today || (item.valid_until !== null && (!is_date(item.valid_until) || item.valid_until < item.valid_from || item.valid_until < today))) error('документ ещё не действует, истёк или даты некорректны');
      }
    }
  }
  return errors;
}

export function get_published(input: publications, today?: string) {
  const errors = validate_publications(input, today);
  if (errors.length) throw new Error('Публикация заблокирована:\n' + errors.join('\n'));
  const approved_news = input.news.filter((entry) => entry.status === 'approved').sort((a, b) => b.published_on.localeCompare(a.published_on));
  const approved_documents = input.documents.filter((entry) => entry.status === 'approved');
  return {
    news: approved_news, documents: approved_documents,
    routes: [...(approved_news.length ? ['/news', ...approved_news.map((entry) => '/news/' + entry.slug)] : []), ...(approved_documents.length ? ['/documents'] : [])],
  };
}
const published = get_published({ news, documents });
export const published_news = published.news;
export const published_documents = published.documents;
export const published_routes = published.routes;

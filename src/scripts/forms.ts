// Значения полей живут только в текущей странице до подтверждённой доставки; browser storage не используется.
// Аналитика получает лишь имя цели.
import { lenis, reducedMotion } from './smooth-scroll.ts';

const initialized = new WeakSet<HTMLFormElement>();
const goal = (name: string) => window.dispatchEvent(new CustomEvent('ses:goal', { detail: { goal: name } }));
const contact_valid = (text: string, callback: boolean) => {
  const phone = /^\+?[\d ()-]+$/u.test(text) && /^\d{10,15}$/u.test(text.replace(/\D/gu, ''));
  return phone || (!callback && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(text));
};

function init_form(form: HTMLFormElement): void {
  if (initialized.has(form)) return;
  initialized.add(form);
  const fields = form.querySelector<HTMLFieldSetElement>('[data-lead-fields]');
  const submit = form.querySelector<HTMLButtonElement>('[data-lead-submit]');
  const status = form.querySelector<HTMLParagraphElement>('[data-form-status]');
  const contact = form.elements.namedItem('contact') as HTMLInputElement | null;
  if (!fields || !submit || !status || !contact) return;
  let busy = false;
  let dirty = false;
  let started = false;
  let key = '';
  let payload_signature = '';
  let success_goal_sent = false;
  const enabled = form.dataset.enabled === 'true' && typeof crypto.randomUUID === 'function';
  const announce = (message: string, error = false) => {
    status.textContent = message;
    status.dataset.state = error ? 'error' : 'info';
  };
  const dirty_handler = (event: BeforeUnloadEvent) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', dirty_handler);
  form.addEventListener('input', (event) => {
    if (!enabled) return;
    dirty = true;
    form.dataset.dirty = 'true';
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      event.target.removeAttribute('aria-invalid');
      event.target.removeAttribute('aria-errormessage');
    }
    contact.setCustomValidity('');
    if (!started) { started = true; goal('form_start'); }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!enabled || busy) return;
    const callback = form.dataset.mode === 'callback';
    contact.setCustomValidity(contact_valid(contact.value.trim(), callback) ? '' : (callback ? 'Введите телефон с кодом страны: от 10 до 15 цифр.' : 'Введите телефон с кодом страны или адрес e-mail.'));
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') || '').trim(),
      contact: String(data.get('contact') || '').trim(),
      message: String(data.get('message') || '').trim(),
      context: form.dataset.context || 'general',
      consent: data.get('consent') === 'on',
      consent_version: form.dataset.consentVersion || '',
      website: String(data.get('website') || ''),
    };
    const body = JSON.stringify(payload);
    // Повтор после сетевой ошибки использует прежний ключ, но редактирование создаёт новую заявку.
    if (body !== payload_signature) { key = crypto.randomUUID(); payload_signature = body; success_goal_sent = false; }
    busy = true;
    fields.disabled = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    announce('Отправляем обращение…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body,
        signal: controller.signal,
      });
      const result: { ok?: boolean; code?: string; receipt?: string; fields?: string[] } = await response.json();
      if (response.ok && result.ok === true && result.code === 'delivered' && typeof result.receipt === 'string') {
        announce('Обращение доставлено. Свяжемся с вами по указанному контакту.');
        if (!success_goal_sent) { goal('lead_success'); success_goal_sent = true; }
        form.reset();
        dirty = false;
        form.dataset.dirty = 'false';
        payload_signature = '';
        key = '';
        started = false;
      } else {
        const messages: Record<string, string> = {
          unavailable: 'Отправка сейчас недоступна. Данные остались в форме. Позвоните или напишите по контактам выше.',
          validation_error: 'Проверьте заполнение полей и согласие на обработку данных. Если условия согласия обновились, скопируйте текст обращения перед обновлением страницы.',
          rate_limited: 'Слишком много попыток. Подождите минуту или свяжитесь с нами напрямую. Данные остались в форме.',
          delivery_uncertain: 'Подтверждение доставки не получено. Не отправляйте обращение повторно: уточните его получение по телефону или e-mail. Данные остались в форме.',
          duplicate_request: 'Такое обращение уже обрабатывается. Уточните получение по телефону или e-mail.',
          request_in_progress: 'Обращение ещё обрабатывается. Подождите или уточните получение по телефону.',
        };
        announce(messages[result.code || ''] || 'Не удалось подтвердить отправку. Данные остались в форме. Свяжитесь с нами по телефону или e-mail.', true);
        if (result.code === 'validation_error' && Array.isArray(result.fields)) {
          for (const name of result.fields) {
            const field = form.elements.namedItem(name);
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
              field.setAttribute('aria-invalid', 'true');
              field.setAttribute('aria-errormessage', status.id);
            }
          }
        }
      }
    } catch {
      announce('Не удалось получить подтверждение доставки. Данные остались в форме. Уточните получение по телефону или e-mail.', true);
    } finally {
      clearTimeout(timeout);
      busy = false;
      fields.disabled = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
      const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      (invalid || status).focus();
    }
  });
  if (enabled) { fields.disabled = false; submit.disabled = false; }
  // Блок обращения на главной: поля открыты для ввода, пока отправка выключена; кнопка остаётся недоступной, данные никуда не уходят и не сохраняются.
  else if (form.hasAttribute('data-open-fill')) fields.disabled = false;
}

export function init_forms(): void {
  document.querySelectorAll<HTMLFormElement>('[data-lead-form]').forEach(init_form);
  // На главной внизу страницы есть готовый блок обращения (#request): кнопки «Заказать звонок» плавно ведут к нему вместо диалога.
  const inline = document.getElementById('request');
  if (inline) {
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-request-open]')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        document.querySelector<HTMLDialogElement>('#menu[open]')?.close();
        document.querySelectorAll<HTMLDialogElement>('dialog.list-modal[open]').forEach((modal) => modal.close()); // кнопка в окне проекта: окна закрываются, страница едет к блоку обращения
        const offset = -(document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0) - 12;
        const focusField = () => inline.querySelector<HTMLElement>('input:not([tabindex="-1"]):not([disabled]), textarea:not([disabled])')?.focus({ preventScroll: true });
        if (lenis && !reducedMotion) lenis.scrollTo(inline, { offset, duration: 1.6, force: true, onComplete: focusField });
        else { inline.scrollIntoView({ block: 'start' }); focusField(); }
        goal('callback_click');
      });
    }
    return;
  }
  const dialog = document.querySelector<HTMLDialogElement>('#request-dialog');
  if (!dialog || typeof dialog.showModal !== 'function' || dialog.dataset.initialized) return;
  dialog.dataset.initialized = 'true';
  let opener: HTMLElement | null = null;
  const openers = document.querySelectorAll<HTMLAnchorElement>('[data-request-open]');
  for (const link of openers) {
    link.setAttribute('role', 'button');
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', dialog.id);
    const open = () => {
      if (dialog.open) return;
      document.querySelector<HTMLDialogElement>('#menu[open]')?.close();
      opener = link;
      const form = dialog.querySelector<HTMLFormElement>('[data-lead-form]');
      if (form && form.dataset.dirty !== 'true') form.dataset.context = link.dataset.requestContext || 'callback';
      dialog.showModal();
      if (link.dataset.requestContext === 'callback') goal('callback_click');
      goal('form_open');
    };
    link.addEventListener('click', (event) => { event.preventDefault(); open(); });
    link.addEventListener('keydown', (event) => {
      if (event.key === ' ') { event.preventDefault(); open(); }
    });
  }
  dialog.querySelector('[data-request-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    const target = opener?.isConnected && opener.offsetParent !== null ? opener : Array.from(document.querySelectorAll<HTMLElement>('[data-request-open]')).find((item) => item.offsetParent !== null);
    target?.focus();
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted && dialog.open) dialog.close(); });
}

init_forms();

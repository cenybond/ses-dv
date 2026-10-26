// Контекст выбирается из реестра, а не задаёт адрес получателя или права доступа.
export const lead_contexts = new Set([
  'general', 'home', 'callback', 'contacts', 'about',
  ...Array.from({ length: 10 }, (_, index) => `service:s-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 14 }, (_, index) => `project:prj-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, index) => `work:prj-14-${String(index + 1).padStart(2, '0')}`),
]);

export const lead_limits = Object.freeze({ name: 80, contact: 254, message: 2000, body: 8192 });
const allowed_fields = new Set(['name', 'contact', 'message', 'context', 'consent', 'consent_version', 'website']);
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export function validate_lead(input, consent_version) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: { form: 'invalid_payload' } };
  if (Object.keys(input).some((key) => !allowed_fields.has(key))) return { errors: { form: 'unknown_field' } };
  const value = (field, max, required = false) => {
    const text = input[field];
    if (typeof text !== 'string' || text.length > max || controls.test(text) || (required && !text.trim())) {
      errors[field] = 'invalid_value';
      return '';
    }
    return text.trim();
  };
  const name = value('name', lead_limits.name, true);
  const contact = value('contact', lead_limits.contact, true);
  const message = value('message', lead_limits.message);
  const context = value('context', 50, true);
  if (typeof input.name === 'string' && /[\r\n<>]/u.test(input.name)) errors.name = 'invalid_name';
  const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(contact);
  const phone = /^\+?[\d ()-]+$/u.test(contact) && /^\d{10,15}$/u.test(contact.replace(/\D/gu, ''));
  if (!email && !phone) errors.contact = 'invalid_contact';
  if (typeof input.contact === 'string' && /[\r\n]/u.test(input.contact)) errors.contact = 'invalid_contact';
  if (!lead_contexts.has(context)) errors.context = 'invalid_context';
  if (input.consent !== true) errors.consent = 'consent_required';
  if (typeof consent_version !== 'string' || !consent_version || input.consent_version !== consent_version) {
    errors.consent_version = 'consent_expired';
  }
  if (typeof input.website !== 'string' || input.website !== '') errors.website = 'spam_detected';
  if (Object.keys(errors).length) return { errors };
  return { lead: Object.freeze({ name, contact, message, context, consent: true, consent_version }) };
}

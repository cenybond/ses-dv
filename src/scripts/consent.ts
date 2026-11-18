// Здесь хранится только выбор аналитики, без идентификатора посетителя и данных формы.
export const consent_key = 'ses-consent';
export const consent_version = 1;
export const consent_ttl = 180 * 24 * 60 * 60 * 1000;
export type Consent = { version: number; analytics: boolean; saved: number };
let memory: Consent | null = null;

export function parse_consent(value: string | null, now = Date.now()): Consent | null {
  try {
    const item = JSON.parse(value || 'null');
    if (!item || item.version !== consent_version || typeof item.analytics !== 'boolean'
      || typeof item.saved !== 'number' || !Number.isFinite(item.saved) || item.saved > now
      || now - item.saved >= consent_ttl) return null;
    return { version: item.version, analytics: item.analytics, saved: item.saved };
  } catch { return null; }
}

export function read_consent(): Consent | null {
  if (memory) return parse_consent(JSON.stringify(memory));
  try { return parse_consent(localStorage.getItem(consent_key)); }
  catch { return memory && parse_consent(JSON.stringify(memory)); }
}

export function save_consent(analytics: boolean): boolean {
  memory = { version: consent_version, analytics, saved: Date.now() };
  let persisted = true;
  try { localStorage.setItem(consent_key, JSON.stringify(memory)); } catch { persisted = false; }
  window.dispatchEvent(new CustomEvent('ses:consent', { detail: memory }));
  return persisted;
}

export function init_consent() {
  const banner = document.querySelector<HTMLElement>('[data-cookie-banner]');
  const dialog = document.querySelector<HTMLDialogElement>('#cookie-settings');
  const checkbox = document.querySelector<HTMLInputElement>('#cookie-analytics');
  const status = document.querySelector<HTMLElement>('[data-cookie-status]');
  const available = banner?.dataset.analyticsAvailable === 'true';
  let trigger: HTMLElement | null = null;
  // Окно выбора показывается, пока посетитель не выбрал (решение владельца 2026-11-18); без подключённого счётчика выбор только запоминается.
  const refresh = () => { if (banner) banner.hidden = read_consent() !== null; };
  const close = () => { dialog?.close(); trigger?.focus(); };
  const choose = (enabled: boolean) => {
    const persisted = save_consent(available && enabled);
    if (banner) banner.hidden = true;
    if (status) status.textContent = persisted ? 'Настройки сохранены.' : 'Выбор действует на этой странице. Браузер не разрешил его сохранить.';
    close();
  };
  document.querySelectorAll<HTMLElement>('[data-cookie-open], [data-cookie-settings]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      trigger = button;
      if (checkbox) checkbox.checked = available && read_consent()?.analytics === true;
      dialog?.showModal();
    });
  });
  document.querySelectorAll('[data-cookie-accept]').forEach((button) => button.addEventListener('click', () => choose(true)));
  document.querySelectorAll('[data-cookie-reject]').forEach((button) => button.addEventListener('click', () => choose(false)));
  document.querySelector('[data-cookie-save]')?.addEventListener('click', () => choose(checkbox?.checked === true));
  document.querySelector('[data-cookie-close]')?.addEventListener('click', close);
  dialog?.addEventListener('close', () => trigger?.focus());
  dialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === consent_key || event.key === null) {
      memory = null;
      window.dispatchEvent(new CustomEvent('ses:consent', { detail: read_consent() }));
      refresh();
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
}

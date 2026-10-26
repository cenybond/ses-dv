/**
 * @typedef {Object} lead_transport
 * @property {'disabled'|'delivery'|'test'} kind
 * @property {(lead: object, options: {signal: AbortSignal, idempotency_key: string}) => Promise<{acknowledged: boolean, reference?: string}>} send
 *
 * Контракт: acknowledged=true допустимо только после подтверждения доставки провайдером.
 * Транспорт обязан передавать idempotency_key провайдеру и соблюдать AbortSignal.
 * Если подтверждение неизвестно, он бросает исключение; UI не заявляет об отправке.
 */

export const disabled_transport = Object.freeze({
  kind: 'disabled',
  async send() { throw new Error('lead_transport_unavailable'); },
});

// Здесь появится утверждённая реализация. Секреты читаются только сервером.
// Тестовый транспорт намеренно существует только в scripts/test-forms.mjs.
export function configure_transport() {
  return disabled_transport;
}

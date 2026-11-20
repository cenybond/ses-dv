# Безопасность: реализация и границы проверки

Статус на 27 октября 2026: локальная инфраструктура подготовлена; внешний transport и production hosting отсутствуют. Этот документ не утверждает, что live-сайт прошёл pentest или что выполнены все production gates.

## Формы

| Риск | Реализация | Граница |
|---|---|---|
| Случайный приём ПДн | Поля disabled; reviewed legal flags false; env false; transport disabled; startup fail closed | Включение только отдельным согласованным коммитом |
| CSRF / cross-origin | Точный Origin, проверка Sec-Fetch-Site, только JSON, нет CORS | XSS в доверенном origin всё ещё опасен |
| Неограниченное тело | Content-Length и фактический stream ограничены 8192 байт; сжатие отвергается | Такие же ограничения нужны reverse proxy |
| Неправильный ввод | Серверная схема, длины/типы, contact, consent version, unknown fields reject, context allowlist | Проверка формата не доказывает владение телефоном/e-mail |
| Спам | Honeypot, IP rate limit 5/60 секунд, ограниченные TTL caches | Не заменяет upstream DDoS-защиту; NAT делит лимит |
| Подмена клиента | X-Real-IP игнорируется, если socket peer не в явном trusted list | Proxy обязан перезаписывать заголовок |
| Дубликаты | Привязка UUID к телу, in-flight lock, повторное подтверждение без доставки, content digest | Один инстанс, TTL 10 минут; после рестарта нужен provider idempotency |
| Ложный успех | Только ack транспорта и reference дают HTTP 200 | Реальный transport ещё не написан и не проверен |
| Timeout / потеря ответа | AbortSignal, 10 секунд timeout, состояние uncertain, без auto retry | Нужен идемпотентный провайдер и процедура проверки доставки |
| Утечка данных | Нет payload/IP logging, browser storage формы или echo входных данных | Hosting/proxy/provider logs требуют отдельной настройки |
| Injection / XSS | JSON ответы, textContent в UI, поля не исполняются, нет SQL/shell/file upload | Будущий transport должен безопасно форматировать plain text/HTML/headers |
| Утечка секретов | Серверный каталог вне Astro public output, .env.example без значений | Проверить CI секреты и реальные права после выбора hosting |

Формы используют минимальный клиентский JavaScript. Browser validation дополняет серверную и не считается защитой сама по себе. Ключи кэшей — HMAC от IP/контекста/тела с краткоживущим секретом процесса; полные обращения в них не лежат. Временная обработка реальных данных всё равно является обработкой ПДн и запрещена до согласования.

## HTTP и развёртывание

Endpoint возвращает `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'; frame-ancestors 'none'`. Других routes он не обслуживает. Node слушает loopback; публичный HTTPS, сертификаты, redirects и security headers статики — ответственность утверждённого deployment. Для API заданы request/header/keepalive timeout и лимит числа headers.

На hosting должны быть отключены directory listing, выдача `.git`, `.env`, `src/`, `server/`, исходников и приватных sourcemaps. Публиковать только `dist` и отдельно исполняемый server. HSTS вводить после проверки HTTPS и rollback-домена; не применять к неизвестным поддоменам автоматически. CSP статики и разрешения для Метрики документируются в конфигурации release и analytics; для карты контактов на главной статика должна разрешать `frame-src https://yandex.ru` (в `scripts/serve-staging.mjs` добавлено, PROD-23); политика API не разрешает внешние скрипты.

Node builtins не добавляют dependency surface. Полный audit установленных зависимостей и сборки относится к общему QA-отчёту. Не трактовать отсутствие новых пакетов как отсутствие уязвимостей в существующих.

## Проверки

`node --test --test-timeout=30000 scripts/test-forms.mjs`: 20 тестов прошли локально. Проверены выключенный режим без чтения тела, запрет test transport снаружи тестов, методы/routes, Origin/CSRF, content-type/encoding, ключ запроса, 17 неверных вариантов данных, реестр 41 контекста, phone/email, отсутствие отражённого HTML, Content-Length/chunked oversize, spoofed proxy header, trusted proxy validation, rate limit, TTL/capacity, повтор/изменённое тело/параллельный дубль, transport exception/negative ack/timeout стабильность provider idempotency key после перезапуска и проверка конфигурации.

Используются только синтетические данные и локальный loopback. Production не изменялся. Внешняя доставка, нагрузка распределённой системы, реальные устройства, внешний pentest, скринридер и эксплуатационные журналы будущего провайдера этим набором не проверены.

## Перед выпуском

Ответственный за инфраструктуру должен проверить реальные secrets/ACL, TLS, доступ к staging, прокси и клиентский IP, ограничения запросов, логи без содержимого форм, режим хранения и удаления у получателя, provider idempotency, мониторинг только технических статусов, аварийное выключение `LEADS_ENABLED`, backup и rollback. Юридическое согласование и разрешение владельца обязательны, см. [forms-integration](forms-integration.md).

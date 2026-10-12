# CONTENT-MAP — карта сохранённого контента

Фаза PHASE 1A. Связывает исходные страницы https://ses-dv.ru/ с локальными текстовыми снимками. Колонка «Новый URL» = `PENDING` до утверждения структуры (IA в этой фазе не проектируется). Снимки: [docs/content/source/](content/source/). Манифест изображений: [_image-manifest.csv](content/source/_image-manifest.csv). Общие элементы: [_shared.md](content/source/_shared.md).

Статусы переноса: **SAVED** — текст сохранён полностью; **SAVED_INCOMPLETE** — сохранён, но часть содержания недоступна для извлечения (CONTENT_INCOMPLETE, причина в снимке); **SAVED_FOR_MIGRATION** — раздел EXCLUDE, зафиксирован для будущей миграции URL, в новый сайт не переносится; **ALIAS/SHARED/NOT_SAVED** — отдельного снимка нет.

Фотографии и сканы не скачивались и в репозиторий не включены: в снимках и манифесте — только адреса на CDN Tilda. Текст, зашитый в изображения (сканы СРО, изображение в «Благодарностях», логотипы заказчиков), не извлекался.

## Страницы

| Исходный URL | Название | Класс | Путь к снимку | Изображений | Статус переноса | Новый URL |
|---|---|---|---|---|---|---|
| `/` | Связь Энергострой | KEEP | [docs/content/source/home.md](content/source/home.md) | 29 (см. снимок) | SAVED_INCOMPLETE | PENDING |
| `/services` | УСЛУГИ | KEEP | [docs/content/source/services.md](content/source/services.md) | 10 (см. снимок) | SAVED | PENDING |
| `/mtb` | МАТЕРИАЛЬНО-ТЕХНИЧЕСКАЯ БАЗА | EXCLUDE | [docs/content/source/mtb.md](content/source/mtb.md) | 13 (см. снимок) | SAVED_FOR_MIGRATION (EXCLUDE, на новый сайт не переносится) | PENDING |
| `/advantages` | ПОЧЕМУ СТОИТ ВЫБРАТЬ | KEEP | [docs/content/source/advantages.md](content/source/advantages.md) | 6 (см. снимок) | SAVED | PENDING |
| `/completed-projects` | ПРОЕКТЫ | KEEP | [docs/content/source/completed-projects.md](content/source/completed-projects.md) | 14 (см. снимок) | SAVED | PENDING |
| `/tlt` | "Таможенно-логистический терминал" (ТЛТ), расположенный по адресу: Амурская область, Благовещенский район, в районе села Каникурган, Гродековского сельсовета | KEEP | [docs/content/source/tlt.md](content/source/tlt.md) | 23 (см. снимок) | SAVED | PENDING |
| `/contacts` | КОНТАКТЫ | KEEP | [docs/content/source/contacts.md](content/source/contacts.md) | 0 | SAVED | PENDING |
| `/vacancies` | ВАКАНСИИ | KEEP | [docs/content/source/vacancies.md](content/source/vacancies.md) | 2 (см. снимок) | SAVED | PENDING |
| `/worker` | Рабочие специальности | KEEP | [docs/content/source/worker.md](content/source/worker.md) | 0 | SAVED | PENDING |
| `/engineers` | Инженерно-технические специальности | KEEP | [docs/content/source/engineers.md](content/source/engineers.md) | 0 | SAVED | PENDING |
| `/sro-p` | СРО П | REVIEW | [docs/content/source/sro-p.md](content/source/sro-p.md) | 2 (см. снимок) | SAVED_INCOMPLETE | PENDING |
| `/sro-s` | СРО С | REVIEW | [docs/content/source/sro-s.md](content/source/sro-s.md) | 4 (см. снимок) | SAVED_INCOMPLETE | PENDING |
| `/privacy` | Политика конфиденциальности | KEEP | [docs/content/source/privacy.md](content/source/privacy.md) | 0 | SAVED | PENDING |
| `/9` | Внеплощадочные (наружные) сети тепло и водоснабжения, напорной канализации | KEEP | [docs/content/source/9.md](content/source/9.md) | 20 (см. снимок) | SAVED | PENDING |
| `/5` | Внутреннее электроснабжение в здании АБК с КПП | KEEP | [docs/content/source/5.md](content/source/5.md) | 6 (см. снимок) | SAVED | PENDING |
| `/6` | Внутреннее электроснабжение в зданиях Перетарочных коплексов | KEEP | [docs/content/source/6.md](content/source/6.md) | 11 (см. снимок) | SAVED | PENDING |
| `/8` | Внутриплощадочное видеонаблюдение | KEEP | [docs/content/source/8.md](content/source/8.md) | 5 (см. снимок) | SAVED | PENDING |
| `/1` | ГНБ под автодорогой Д-1 Хэйхэ – Благовещенск для последующего устройства сетей тепловодоснабжения и напорной канализации | KEEP | [docs/content/source/1.md](content/source/1.md) | 15 (см. снимок) | SAVED | PENDING |
| `/11` | Заземления мобильной АЗС | KEEP | [docs/content/source/11.md](content/source/11.md) | 8 (см. снимок) | SAVED | PENDING |
| `/3` | Наружное электроосвещение | KEEP | [docs/content/source/3.md](content/source/3.md) | 16 (см. снимок) | SAVED | PENDING |
| `/2` | Наружное электроснабжение | KEEP | [docs/content/source/2.md](content/source/2.md) | 22 (см. снимок) | SAVED | PENDING |
| `/7` | Наружные сети связи | KEEP | [docs/content/source/7.md](content/source/7.md) | 10 (см. снимок) | SAVED | PENDING |
| `/4` | Сборка и пусконаладка модульной БКТП | KEEP | [docs/content/source/4.md](content/source/4.md) | 21 (см. снимок) | SAVED | PENDING |
| `/12` | Сварка и монтаж несущей фермы дымохода газовой котельной | KEEP | [docs/content/source/12.md](content/source/12.md) | 9 (см. снимок) | SAVED | PENDING |
| `/10` | Электрообогрев внеплощадочных (наружных) сетей водоснабжения, напорной канализации | KEEP | [docs/content/source/10.md](content/source/10.md) | 6 (см. снимок) | SAVED | PENDING |
| `/news` | НОВОСТИ | EMPTY | [docs/content/source/news.md](content/source/news.md) | 0 | SAVED_INCOMPLETE | PENDING |
| `/aks` | Выполнение строительно — монтажных работ по реконструкции кабельных линий для нужд ООО «Амурские коммунальные системы», на двух участках: 10 кВ ТП-19-ТП9Б, 10 кВ ТП 58А-ТП98. | KEEP | [docs/content/source/aks.md](content/source/aks.md) | 18 (см. снимок) | SAVED | PENDING |
| `/pns` | Строительство ПНС в ЗПУ-А1, район Молокозавода с реконструкцией водовода для дома по ул. Мичурина 15, Этап 1 | KEEP | [docs/content/source/pns.md](content/source/pns.md) | 18 (см. снимок) | SAVED | PENDING |
| `/smr-kalinina` | Строительно-монтажные работы по замене участка водопроводной сети по ул. Калинина между ул. Игнатьевское шоссе и ул. Воронкова | KEEP | [docs/content/source/smr-kalinina.md](content/source/smr-kalinina.md) | 7 (см. снимок) | SAVED | PENDING |
| `/tp-10` | Строительство ТП-10/0,4 кВ, ВЛЗ-10 кВ, ЛЭП-0,4 кВ | KEEP | [docs/content/source/tp-10.md](content/source/tp-10.md) | 0 | SAVED | PENDING |
| `/philharmonic` | Капитальный ремонт конторских помещений объекта: ГАУКАО «Амурская областная филармония», по адресу: Амурская область, г. Благовещенск, ул. Пионерская 1 | KEEP | [docs/content/source/philharmonic.md](content/source/philharmonic.md) | 12 (см. снимок) | SAVED | PENDING |
| `/gratitude` | Благодарности | EXCLUDE | [docs/content/source/gratitude.md](content/source/gratitude.md) | 1 (см. снимок) | SAVED_FOR_MIGRATION (EXCLUDE, на новый сайт не переносится) · CONTENT_INCOMPLETE | PENDING |
| `/chp` | Благовещенская ТЭЦ | KEEP | [docs/content/source/chp.md](content/source/chp.md) | 6 (см. снимок) | SAVED | PENDING |
| `/page55167833.html` | Blank page | REVIEW | [docs/content/source/page55167833.md](content/source/page55167833.md) | 2 (см. снимок) | SAVED (REVIEW) | PENDING |
| `/akik` | Проведение выборочного капитального ремонта концертного зала, расположенного в здании учебного корпуса ГПОБУ АО "АКИК" | KEEP | [docs/content/source/akik.md](content/source/akik.md) | 2 (см. снимок) | SAVED | PENDING |
| `/ktp` | Реконструкция трансформаторных подстанций КТП № 195 и КТП № 479 | KEEP | [docs/content/source/ktp.md](content/source/ktp.md) | 5 (см. снимок) | SAVED | PENDING |
| `/pumping-station` | Капитальный ремонт канализационной насосной станции в квартале 374 г. Благовещенска | KEEP | [docs/content/source/pumping-station.md](content/source/pumping-station.md) | 5 (см. снимок) | SAVED | PENDING |
| `/clap` | Строительство КЛЭП-10кВ от РУ-10кВ ТП-27А до РУ-10кВ ТП-31 в рамках Технологического присоединения энергопринимающих устройств для Сохранения объекта культурного наследия | KEEP | [docs/content/source/clap.md](content/source/clap.md) | 4 (см. снимок) | SAVED | PENDING |
| `/residential-complex` | Жилой комплекс «Северный жилой район» | KEEP | [docs/content/source/residential-complex.md](content/source/residential-complex.md) | 5 (см. снимок) | SAVED | PENDING |
| `/hc` | ДК Железнодорожников | KEEP | [docs/content/source/hc.md](content/source/hc.md) | 36 (см. снимок) | SAVED | PENDING |
| `/hope` | Санаторий-профилакторий "Надежда" | KEEP | [docs/content/source/hope.md](content/source/hope.md) | 32 (см. снимок) | SAVED | PENDING |
| `/about` | ООО «Связь Энергострой» | DUPLICATE | [docs/content/source/about.md](content/source/about.md) | 14 (см. снимок) | SAVED_INCOMPLETE | PENDING |
| `/page36856596.html` | ООО «Связь Энергострой» | DUPLICATE | — | 0 | ALIAS → about.md | PENDING |
| `/page36947770.html` | Рабочие специальности | DUPLICATE | — | 0 | ALIAS → worker.md | PENDING |
| `/page36947815.html` | Инженерно-технические специальности | DUPLICATE | — | 0 | ALIAS → engineers.md | PENDING |
| `/page36905041.html` | Шапка | EMPTY | — | 0 | SHARED → _shared.md (шапка) | PENDING |
| `/page36948207.html` | Blank page | EMPTY | — | 0 | SHARED → _shared.md (подвал) | PENDING |
| `/page36950621.html` | 404 | EMPTY | — | 0 | NOT_SAVED (шаблон 404, нет контента) | PENDING |
| `/error` | 404 | EMPTY | — | 0 | NOT_SAVED (шаблон 404, нет контента) | PENDING |
| `/index.html` | 404 | EMPTY | — | 0 | NOT_SAVED (404) | PENDING |

## Блоки внутри страниц, требующие отдельного решения (факты)

| Страница | Блок | Факт | Метка |
|---|---|---|---|
| `/contacts` | адрес офиса | Старый адрес присутствует в тексте страницы. В новой версии адрес = ADDRESS_PENDING, старый не переносить. | ADDRESS_PENDING |
| `/`, `/about` | cookie-баннер | Есть только на этих двух страницах; ссылка «Подробнее» → /privacy. | — |
| `/`, `/about` | блок «НОВОСТИ» | Лента не загружается («Feed not found.»), контента нет. | CONTENT_INCOMPLETE |
| `/`, `/about` | «НАШИ ЗАКАЗЧИКИ» | Только 8 логотипов-изображений без текста и alt. | CONTENT_INCOMPLETE |
| `/`, `/about`, `/sro-p`, `/sro-s` | сканы СРО | Текст допусков есть в тексте главной (наименования СРО и рег. номера); сами документы — сканы JPG (2 + 4 страницы). | CONTENT_INCOMPLETE (сканы) |
| `/privacy` | политика ПДн | Сохранена полностью (~17 900 знаков). Актуальность не подтверждена (A-08). ИНН/ОГРН оператора в тексте нет (Q-02). | REVIEW |
| все страницы | попап «Мы рады сотрудничать с Вами!» | Общая форма заявки (Имя, Телефон, Email, «Ваш вопрос»). Вынесена в _shared.md. | — |
| `/services` | форма заказа | Кнопки «Заказать» (9) открывают попап `#popup:myformzakaz`. | — |

## Связи между исходными страницами (по ссылкам)

Это описание текущей структуры по фактическим ссылкам, а не предложение новой IA.

| Страница-источник | Ссылается на |
|---|---|
| `/completed-projects` (14 карточек) | `/akik`, `/aks`, `/chp`, `/clap`, `/hc`, `/hope`, `/ktp`, `/philharmonic`, `/pns`, `/pumping-station`, `/residential-complex`, `/smr-kalinina`, `/tlt`, `/tp-10` |
| `/tlt` (12 карточек «Подробнее») | `/1`, `/10`, `/11`, `/12`, `/2`, `/3`, `/4`, `/5`, `/6`, `/7`, `/8`, `/9` |
| `/vacancies` (2 карточки «Подробнее») | `/page36947770.html`, `/page36947815.html` |
| шапка/подвал (все страницы) | `/`, `/advantages`, `/completed-projects`, `/contacts`, `/gratitude`, `/mtb`, `/news`, `/privacy`, `/services`, `/vacancies` |

Проверка полноты проектов: все 14 целей из «Проектов» и все 12 целей из «ТЛТ» входят в sitemap: да. Страница `/page55167833.html` (проект «Перенос модульной котельной…») в карточках «Проектов» отсутствует.

Услуги: 9 позиций находятся на одной странице `/services` (отдельных URL у услуг нет).

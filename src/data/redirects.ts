// Реестр всех 50 URL из docs/URL-MIGRATION.md. Ничего не включает на production автоматически.
export interface Redirect { from: string; to: string | null; action: 'KEEP' | 'MOVE' | 'MERGE' | 'REDIRECT' | 'REMOVE' | 'REVIEW'; status: 200 | 301 | 404 | 410 | null; reason: string; }
export const redirects: readonly Redirect[] = [
  {
    "from": "/",
    "to": "/",
    "action": "KEEP",
    "status": 200,
    "reason": "Адрес главной сохраняется; структура главной меняется (INFORMATION-ARCHITECTURE §5), тексты hero переносятся дословно."
  },
  {
    "from": "/services",
    "to": "/services",
    "action": "KEEP",
    "status": 200,
    "reason": "Единый каталог из 9 услуг сохраняет адрес и смысл. Названия услуг переносятся дословно."
  },
  {
    "from": "/mtb",
    "to": null,
    "action": "REMOVE",
    "status": 410,
    "reason": "Раздел «Оснащение» (МАТЕРИАЛЬНО-ТЕХНИЧЕСКАЯ БАЗА) исключён заказчиком. Релевантной страницы-преемника нет; 301 на главную запрещён (A-11)."
  },
  {
    "from": "/advantages",
    "to": "/about",
    "action": "MERGE",
    "status": 301,
    "reason": "5 пунктов «ПОЧЕМУ СТОИТ ВЫБРАТЬ» и кнопка «Сотрудничать» переходят в одноимённую секцию страницы «О компании». Отдельная страница из 5 строк не нужна."
  },
  {
    "from": "/completed-projects",
    "to": "/projects",
    "action": "MOVE",
    "status": 301,
    "reason": "Каталог проектов: тот же смысл, нейтральное имя вместо «completed» (в каталоге есть и «текущие» проекты по тексту страницы)."
  },
  {
    "from": "/tlt",
    "to": "/projects/tlt",
    "action": "MOVE",
    "status": 301,
    "reason": "Проект PRJ-14 (родитель 12 видов работ) в единой схеме `/projects/{slug}`."
  },
  {
    "from": "/contacts",
    "to": "/contacts",
    "action": "KEEP",
    "status": 200,
    "reason": "Контакты, форма, реквизиты после подтверждения. Старый адрес и карта не переносятся (ADDRESS_PENDING)."
  },
  {
    "from": "/vacancies",
    "to": "/vacancies",
    "action": "KEEP",
    "status": 200,
    "reason": "Единая страница вакансий: две группы и три вакансии с описанием и откликом."
  },
  {
    "from": "/worker",
    "to": "/vacancies",
    "action": "MERGE",
    "status": 301,
    "reason": "Две вакансии («Электромонтер (4 разряда)», «Строитель-отделочник») становятся группой «Рабочие специальности» на `/vacancies`. Описания дословно."
  },
  {
    "from": "/engineers",
    "to": "/vacancies",
    "action": "MERGE",
    "status": 301,
    "reason": "Вакансия «Ведущий инженер ПТО» становится группой «Инженерно-технические специальности» на `/vacancies`. Описание дословно."
  },
  {
    "from": "/sro-p",
    "to": null,
    "action": "REVIEW",
    "status": null,
    "reason": "Страница состоит из двух сканов 2023 года и отображается пустой. Сканы заказчиком признаны неактуальными (A-15). Вариант: 301 → `/documents` после публикации актуальных документов; если страница `/documents` не публикуется — 410."
  },
  {
    "from": "/sro-s",
    "to": null,
    "action": "REVIEW",
    "status": null,
    "reason": "То же: четыре скана 2023 года, страница пустая. Вариант: 301 → `/documents` после публикации актуальных документов, иначе 410."
  },
  {
    "from": "/privacy",
    "to": "/privacy",
    "action": "KEEP",
    "status": 200,
    "reason": "Обязательная страница политики (A-08). Текст дословно; перед публикацией нужна юридическая проверка, актуальность не подтверждена."
  },
  {
    "from": "/1",
    "to": "/projects/tlt/gnb-d-1",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-01. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/2",
    "to": "/projects/tlt/naruzhnoe-elektrosnabzhenie",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-02. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/3",
    "to": "/projects/tlt/naruzhnoe-elektroosveshchenie",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-03. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/4",
    "to": "/projects/tlt/bktp",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-04. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/5",
    "to": "/projects/tlt/vnutrennee-elektrosnabzhenie-abk",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-05. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/6",
    "to": "/projects/tlt/vnutrennee-elektrosnabzhenie-peretarochnye",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-06. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/7",
    "to": "/projects/tlt/naruzhnye-seti-svyazi",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-07. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/8",
    "to": "/projects/tlt/videonablyudenie",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-08. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/9",
    "to": "/projects/tlt/vneploshchadochnye-seti",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-09. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/10",
    "to": "/projects/tlt/elektroobogrev-setey",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-10. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/11",
    "to": "/projects/tlt/zazemlenie-azs",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-11. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/12",
    "to": "/projects/tlt/fermy-dymokhoda",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-14-12. Вид работ на объекте ТЛТ. Название и описание дословно; цифровой адрес заменяется смысловым (slug — Proposed)."
  },
  {
    "from": "/news",
    "to": null,
    "action": "REVIEW",
    "status": null,
    "reason": "Раздел сохраняется (A-13). Лента не работает («Feed not found.»). Вариант: маршрут зарезервирован, до первой реальной публикации отвечает 404 и не входит в sitemap; после публикации — 200. 301 на главную не используется."
  },
  {
    "from": "/aks",
    "to": "/projects/aks",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-13."
  },
  {
    "from": "/pns",
    "to": "/projects/pns",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-12. Литерал `#nbsp;` в старом title не переносится."
  },
  {
    "from": "/smr-kalinina",
    "to": "/projects/smr-kalinina",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-11."
  },
  {
    "from": "/tp-10",
    "to": "/projects/tp-10",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-10."
  },
  {
    "from": "/philharmonic",
    "to": "/projects/philharmonic",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-09."
  },
  {
    "from": "/gratitude",
    "to": null,
    "action": "REMOVE",
    "status": 410,
    "reason": "Раздел «Благодарности» исключён заказчиком. Релевантной замены нет; 301 на главную запрещён (A-11). Содержание — одно изображение."
  },
  {
    "from": "/chp",
    "to": "/projects/chp",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-08."
  },
  {
    "from": "/page55167833.html",
    "to": null,
    "action": "REVIEW",
    "status": null,
    "reason": "Проверка (URL-MIGRATION §4.2): на странице описан реальный проект («Перенос модульной котельной…»), title «Blank page», нет входящих ссылок, фото нерелевантно. Проект и исходный текст сохранены в архитектуре как REVIEW (A-19). Нерелевантное фото основанием для исключения не является: оно заменяется заглушкой или фото заказчика. **410 автоматически не планируется.** Если заказчик подтвердит публикацию: 301 → страница проекта PRJ-15. Любой иной исход определяет только заказчик (Q-18); 301 на главную не используется."
  },
  {
    "from": "/akik",
    "to": "/projects/akik",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-07."
  },
  {
    "from": "/ktp",
    "to": "/projects/ktp",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-06."
  },
  {
    "from": "/pumping-station",
    "to": "/projects/pumping-station",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-05."
  },
  {
    "from": "/clap",
    "to": "/projects/clap",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-04."
  },
  {
    "from": "/residential-complex",
    "to": "/projects/residential-complex",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-03."
  },
  {
    "from": "/hc",
    "to": "/projects/hc",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-02. Страница с 36 фото: вес — вопрос SPEC."
  },
  {
    "from": "/hope",
    "to": "/projects/hope",
    "action": "MOVE",
    "status": 301,
    "reason": "PRJ-01. Страница с 32 фото: вес — вопрос SPEC."
  },
  {
    "from": "/about",
    "to": "/about",
    "action": "KEEP",
    "status": 200,
    "reason": "Прежняя версия главной (noindex, Disallow, canonical → `/`) не имела самостоятельной поисковой роли. Адрес получает новую страницу «О компании». Нужно снять Disallow и noindex и поставить self-canonical."
  },
  {
    "from": "/page36856596.html",
    "to": "/about",
    "action": "REDIRECT",
    "status": 301,
    "reason": "Байт-в-байт копия прежнего `/about`. Релевантная цель теперь существует. Необязательное правило (низкий приоритет)."
  },
  {
    "from": "/page36947770.html",
    "to": "/vacancies",
    "action": "MERGE",
    "status": 301,
    "reason": "Копия `/worker`; именно на неё ведёт ссылка «Подробнее» с `/vacancies`, поэтому у адреса могут быть закладки и внешние ссылки. Цель — сразу `/vacancies` (без цепочки через `/worker`)."
  },
  {
    "from": "/page36947815.html",
    "to": "/vacancies",
    "action": "MERGE",
    "status": 301,
    "reason": "Копия `/engineers`; на неё ведёт ссылка «Подробнее» с `/vacancies`. Цель — сразу `/vacancies`."
  },
  {
    "from": "/page36905041.html",
    "to": null,
    "action": "REMOVE",
    "status": 404,
    "reason": "Служебный шаблон шапки Tilda («Шапка»), закрыт в robots.txt. В новой структуре не существует."
  },
  {
    "from": "/page36948207.html",
    "to": null,
    "action": "REMOVE",
    "status": 404,
    "reason": "Служебный шаблон подвала Tilda («Blank page»), закрыт в robots.txt."
  },
  {
    "from": "/page36950621.html",
    "to": null,
    "action": "REMOVE",
    "status": 404,
    "reason": "Служебный шаблон 404 Tilda, сейчас отдаёт 200 (мягкая 404). В новой структуре настоящая 404."
  },
  {
    "from": "/error",
    "to": null,
    "action": "REMOVE",
    "status": 404,
    "reason": "Страница ошибки Tilda с кодом 200 (мягкая 404). В новом сайте страница 404 отвечает кодом 404 на любой несуществующий адрес."
  },
  {
    "from": "/index.html",
    "to": null,
    "action": "REMOVE",
    "status": 404,
    "reason": "Сейчас отвечает 404. Остаётся 404; редирект не вводится."
  }
];

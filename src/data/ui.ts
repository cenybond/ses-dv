// Подписи интерфейса демо (U): меню, кнопки, подписи элементов, уведомления о демо, подписи заглушек, доступные имена.
// Исходные описания компании здесь не хранятся (они в data/source/*). Единый файл на согласование (ARCHITECTURE-DEMO §3).
//
// Контроль `scripts/check-copy.mjs`:
//   • `uiSources` — какие подписи взяты из снимков docs/content/source/ дословно (кнопки и подписи полей действующего сайта);
//   • `uiSpec`    — какие подписи заданы в SPEC-DEMO.md в «ёлочках»: текст должен совпадать с ним;
//   • остальные подписи авторские (U) и сверке не подлежат, но не должны содержать внутренних маркеров
//     DESCRIPTION_PENDING, ADDRESS_PENDING, SOURCE_SUPPORTED, CLIENT_APPROVED.
// Подсказка поля телефона — U («+7 (000) 000-00-00» вместо «+1(000)000-0000» источника, SPEC-DEMO §12, Q-24).
// Сообщения проверки формы остаются в design/system/system.js до переноса скриптов в DEMO-05.
import type { SourceRef } from './types.ts';

const demoTitle = 'Демонстрационная версия';
const demoText =
  'Не является действующим сайтом компании. Тексты перенесены с действующего сайта, их актуальность подтверждается заказчиком';

export const ui = {
  demo: {
    title: demoTitle,
    text: demoText,
    /** Полоса вверху каждой страницы (SPEC-DEMO §10). */
    strip: `${demoTitle}. ${demoText}`,
    skipLink: 'К основному контенту',
    formNotice: 'Демонстрационная форма. Заявка не будет отправлена',
    formDone: 'Это демонстрация. Заявка не отправлена, введённые данные не сохранены',
    formNoScript: 'для работы демонстрационной формы нужен JavaScript',
    privacyNotice:
      'Демонстрационная страница. Текст перенесён с действующего сайта и не проверен юристом; не является актуальной редакцией',
  },
  nav: {
    services: 'Услуги',
    projects: 'Проекты',
    about: 'О нас',
    contacts: 'Контакты',
    privacy: 'Политика конфиденциальности',
    vacancies: 'Вакансии',
    footerHeading: 'Разделы',
    contactsHeading: 'Контакты',
  },
  /** Доступные имена и подписи для вспомогательных технологий. */
  a11y: {
    mainNav: 'Основная навигация',
    footerNav: 'Разделы сайта',
    menu: 'Меню',
    menuNav: 'Навигация в меню',
    closeMenu: 'Закрыть меню',
    quickActions: 'Быстрые действия',
    close: 'Закрыть',
    logo: 'Связь Энергострой — на начало страницы',
    openProject: (title: string) => `Открыть проект «${title}»`,
  },
  actions: {
    order: 'Заказать',
    orderCall: 'Заказать звонок',
    cooperate: 'Сотрудничать',
    submit: 'Отправить',
    allServices: 'Все услуги',
    allProjects: 'Все проекты',
    aboutMore: 'Подробнее о компании',
    toCatalog: 'Все проекты',
    call: 'Позвонить',
    leaveRequest: 'Оставить заявку',
    close: 'Закрыть',
    fillAgain: 'Заполнить снова',
    whatsapp: 'WhatsApp',
  },
  /** Hero главной: подзаголовок из макета Figma «Главная — desktop 1440», передан владельцем 2026-11-18. */
  hero: {
    subtitle: ['От проекта до готовой инфраструктуры.', 'Спроектируем и построим инженерные сети для вашего объекта.'],
    photoNote: 'Временный кадр: иллюстрация, не объект СЭС',
  },
  /** Блок «О нас» главной: заголовок и местоимение перед лидом из макета Figma (Frame 4), передано владельцем 2026-11-18. */
  homeAbout: { heading: 'О нас', leadPrefix: 'Мы' },
  /** Подпись под «Проекты» на главной. Число N владелец ещё не назвал (2026-11-18): пока стоит буква N как заглушка, цифру не выдумывать. */
  homeProjects: { note: 'Более N готовых решений под разные уровни сложности', more: 'Еще работы' },
  /** Подписи блоков страниц (заголовки секций — предложение, SPEC-DEMO §6). */
  sections: {
    workTypes: 'Виды работ',
    relatedServices: 'Связанные направления',
    competencies: 'Компетенции',
    documents: 'Допуски и документы',
  },
  /** Заглушки и недоступные элементы: видимые пометки, не только цвет (SPEC-DEMO §7, §11). */
  placeholders: {
    photo: 'Место для фотографии',
    serviceDescription: 'Описание будет добавлено',
    projectPage: 'Страница в полной версии',
    feature: 'В полной версии',
    address: 'Адрес уточняется',
    documents: 'Актуальные документы будут добавлены после получения от заказчика',
    linkPreliminary: 'Связь предварительная, ожидает подтверждения заказчиком',
  },
  /** Страницы-заготовки до наполнения (DEMO-06…12): честно сообщают, что содержимого ещё нет. */
  stub: {
    note: 'Содержимое этой страницы появится на следующем этапе разработки демо',
    home: 'На главную',
  },
  notFound: {
    title: 'Страница не найдена',
    lead: 'Проверьте адрес или перейдите в нужный раздел',
    heading: 'Такой страницы не существует',
    back: 'Вернуть на главную',
  },
  contactLabels: {
    phone: 'Телефон',
    email: 'E-mail',
    address: 'Адрес',
  },
  /** Блок обращения (H-05, CTA, диалог заявки): тексты действующего сайта дословно. */
  cta: {
    heading: 'Мы рады сотрудничать с Вами!',
    lead: 'Заполните данные и мы свяжемся с Вами в ближайшее время',
    consent: 'Нажимая кнопку "Отправить" вы соглашаетесь с Политикой конфиденциальности',
    consentLink: 'Политикой конфиденциальности',
  },
  form: {
    labels: {
      email: 'Ваш Email',
      name: 'Ваше имя',
      phone: 'Ваш телефон',
      question: 'Ваш вопрос',
    },
    placeholders: {
      email: 'Email',
      name: 'Имя',
      phone: '+7 (000) 000-00-00',
      question: 'Введите Ваш вопрос',
    },
  },
} as const;

/** Подписи из снимков: путь в `ui` → ссылка на строку снимка (формат — SourceRef в types.ts). */
export const uiSources = {
  'actions.order': 'services.md#rec596139915/3',
  'actions.orderCall': '_shared.md#rec666328298/2',
  'actions.cooperate': 'advantages.md#rec596853171/8',
  'actions.submit': 'services.md#cell:Отправить',
  'nav.privacy': '_shared.md#rec596865686/6',
  'cta.heading': 'services.md#rec596170576/1',
  'cta.lead': 'services.md#rec596170576/2',
  'cta.consent': 'services.md#rec596170576/3',
  'cta.consentLink': 'services.md#cell:Политикой конфиденциальности',
  'form.labels.email': '_shared.md#quote:Ваш Email',
  'form.labels.name': '_shared.md#quote:Ваше имя',
  'form.labels.phone': '_shared.md#quote:Ваш телефон',
  'form.labels.question': '_shared.md#quote:Ваш вопрос',
  'form.placeholders.email': '_shared.md#cell:Email',
  'form.placeholders.name': '_shared.md#cell:Имя',
  'form.placeholders.question': '_shared.md#cell:Введите Ваш вопрос',
} as const satisfies Record<string, SourceRef>;

/** Подписи, заданные в SPEC-DEMO.md в «ёлочках»: `check-copy` ищет `«текст»` в SPEC-DEMO.md. */
export const uiSpec = [
  'demo.strip',
  'demo.formNotice',
  'demo.formDone',
  'demo.formNoScript',
  'demo.privacyNotice',
  'actions.allServices',
  'actions.allProjects',
  'actions.aboutMore',
  'actions.toCatalog',
  'actions.call',
  'actions.leaveRequest',
  'actions.close',
  'actions.fillAgain',
  'sections.workTypes',
  'sections.relatedServices',
  'sections.competencies',
  'placeholders.photo',
  'placeholders.serviceDescription',
  'placeholders.projectPage',
  'placeholders.feature',
  'placeholders.documents',
  'placeholders.linkPreliminary',
  'form.placeholders.phone',
] as const;
export const pageui = {
  home: 'Главная', breadcrumbs: 'Хлебные крошки', photos: 'Фотографии проекта', photoawaiting: 'Фотографии объекта готовятся к публикации', photodisclaimer: 'Этот блок не является изображением выполненного объекта', contact: 'Свяжитесь с нами', allcontacts: 'Все контакты', project: 'Проект', work: 'Работы на объекте', backtlt: 'К объекту ТЛТ', projectphotos: 'Фотографии объекта', servicenote: 'Уточните состав работ по вашему объекту',  moreprojects: 'Другие проекты', previous: 'Предыдущий проект', next: 'Следующий проект', previouswork: 'Предыдущий вид работ', nextwork: 'Следующий вид работ', works: 'Состав работ', related: 'Направления работ', relatednote: 'Связь с направлением указана по описанию работ на объекте.', allservices: 'К направлениям деятельности', aboutmeta: 'ООО «Связь Энергострой»: деятельность, структура компании и выполненные проекты.', departments: 'Структура компании', company: 'О компании', vacancies: 'Вакансии', vacanciesmeta: 'Рабочие и инженерно-технические специальности ООО «Связь Энергострой». Уточнение актуальности вакансий и контакты.', vacancynotice: 'Ниже сохранены описания вакансий с прежнего сайта. Актуальность набора и условия уточняются. Свяжитесь с компанией перед откликом.', vacancyarchive: 'Актуальность набора уточняется', vacancycontact: 'Уточнить наличие вакансии', contactsmeta: 'Контактные телефоны и электронная почта ООО «Связь Энергострой». Обсудите проект или задайте вопрос.', addressnotice: 'Адрес и реквизиты будут опубликованы после подтверждения.', contactconfirmation: 'Контакты перенесены с прежнего сайта; актуальность подтверждается перед запуском.', inquiry: 'Обсудить задачу', documentsnotice: 'Публикация действующих допусков и документов готовится после подтверждения их актуальности.', departmentsnotice: 'Структура перенесена с прежнего сайта; актуальность подтверждается перед запуском.', errorcode: '404', errorheading: 'Найдём нужный раздел', errormeta: 'Запрошенная страница не найдена. Перейдите к услугам, проектам или контактам ООО «Связь Энергострой».', photo: 'Фото ожидается', openproject: 'Открыть проект', tltshort: 'ТЛТ', worknavigation: 'Навигация по видам работ', projectnavigation: 'Навигация по проектам', projectsource: 'Информация об объекте перенесена с прежнего сайта. Фотоматериалы проходят подготовку к публикации.', workdescription: 'Описание работ', advantages: 'Почему выбирают СЭС'
} as const;

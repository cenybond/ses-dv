/* Style guide: значения читаются из CSS-токенов (../system/tokens.css), поэтому страница не может разойтись с системой. */
(function () {
  'use strict';
  var root = getComputedStyle(document.documentElement);
  var tok = function (n) { return root.getPropertyValue(n).trim(); };
  var $ = function (s) { return document.querySelector(s); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- контраст (WCAG 2.x) ---------- */
  function lum(hex) {
    var h = hex.replace('#', ''), c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
  var isHex = function (v) { return /^#[0-9a-f]{6}$/i.test(v); };

  /* ---------- палитра ---------- */
  var groups = [
    ['Бренд', [
      ['--color-brand', 'Brand primary', 'ссылки, фокус, плитки, акцентные заголовки', 'Approved A-12'],
      ['--color-accent', 'Brand accent', 'главная кнопка, метки, подчёркивания', 'Approved A-12'],
      ['--color-accent-hover', 'Accent hover', 'наведение на главную кнопку', 'Proposed'],
      ['--color-accent-mid', 'Accent mid', 'нажатие главной кнопки; цвет из знака', 'Approved A-12'],
      ['--color-accent-deep', 'Accent deep', 'резерв; цвет из знака', 'Approved A-12']
    ]],
    ['Фон и поверхности', [
      ['--color-bg', 'Background primary', 'фон страницы', 'Proposed'],
      ['--color-bg-alt', 'Background secondary', 'блок обращения, выделенные плашки', 'Proposed'],
      ['--color-surface', 'Surface', 'карточки, поля, диалоги', 'Proposed'],
      ['--color-bg-dark', 'Тёмная зона', 'footer, демо-полоса', 'Proposed'],
      ['--color-bg-dark-alt', 'Тёмная зона, вариант', 'hero без фотографии', 'Proposed']
    ]],
    ['Текст', [
      ['--color-text', 'Text primary', 'основной текст', 'Proposed'],
      ['--color-text-muted', 'Text secondary', 'подписи, пояснения', 'Proposed'],
      ['--color-text-on-dark', 'Text on dark', 'основной на тёмном', 'Proposed'],
      ['--color-text-on-dark-muted', 'Text on dark, secondary', 'вторичный на тёмном', 'Proposed'],
      ['--color-placeholder', 'Placeholder', 'подсказка в поле', 'Proposed']
    ]],
    ['Границы и состояния', [
      ['--color-border', 'Border', 'разделители (декор)', 'Proposed'],
      ['--color-border-strong', 'Border strong', 'границы полей, вторичных кнопок', 'Proposed'],
      ['--color-focus', 'Focus', 'кольцо фокуса на светлом', 'Proposed (= brand)'],
      ['--color-focus-on-dark', 'Focus on dark', 'кольцо фокуса на тёмном', 'Proposed (= accent)'],
      ['--color-error', 'Error', 'ошибки проверки', 'Proposed'],
      ['--color-success', 'Success', 'результат, всегда с текстом', 'Proposed (= brand)'],
      ['--color-disabled-bg', 'Disabled background', 'недоступная кнопка/поле', 'Proposed'],
      ['--color-disabled-text', 'Disabled text', 'недоступная кнопка/поле', 'Proposed']
    ]]
  ];
  var host = $('#sg-palette');
  if (host) groups.forEach(function (g) {
    host.appendChild(el('h3', null, g[0]));
    var grid = el('div', 'sg-grid');
    g[1].forEach(function (t) {
      var hex = tok(t[0]);
      var s = el('div', 'sg-sw');
      s.innerHTML = '<div class="sg-sw__c" style="--c:var(' + t[0] + ')"></div><div class="sg-sw__t"><b>' + t[1] + '</b><code>' + t[0] + '</code><span>' + hex.toUpperCase() + ' · ' + t[3] + '</span><span>' + t[2] + '</span></div>';
      grid.appendChild(s);
    });
    host.appendChild(grid);
  });

  /* ---------- таблица контраста ---------- */
  var pairs = [
    ['Основной текст на странице', '--color-text', '--color-bg', 4.5],
    ['Основной текст на карточке', '--color-text', '--color-surface', 4.5],
    ['Вторичный текст на странице', '--color-text-muted', '--color-bg', 4.5],
    ['Вторичный текст на блоке обращения', '--color-text-muted', '--color-bg-alt', 4.5],
    ['Ссылка/акцент brand на странице', '--color-brand', '--color-bg', 4.5],
    ['Ссылка brand на карточке', '--color-brand', '--color-surface', 4.5],
    ['Белый на brand (плитка «Все услуги»)', '--color-on-brand', '--color-brand', 4.5],
    ['Текст кнопки на accent', '--color-on-accent', '--color-accent', 4.5],
    ['Текст кнопки на accent при наведении', '--color-on-accent', '--color-accent-hover', 4.5],
    ['Текст кнопки на accent при нажатии', '--color-on-accent', '--color-accent-mid', 4.5],
    ['Основной на тёмном', '--color-text-on-dark', '--color-bg-dark', 4.5],
    ['Вторичный на тёмном', '--color-text-on-dark-muted', '--color-bg-dark', 4.5],
    ['Белый на hero без фото', '--color-on-brand', '--color-bg-dark-alt', 4.5],
    ['Ошибка на карточке', '--color-error', '--color-surface', 4.5],
    ['Ошибка на блоке обращения', '--color-error', '--color-bg-alt', 4.5],
    ['Подсказка в поле', '--color-placeholder', '--color-surface', 4.5],
    ['Граница поля / кнопки (нетекстовый элемент)', '--color-border-strong', '--color-surface', 3],
    ['Граница поля на фоне страницы', '--color-border-strong', '--color-bg', 3],
    ['Фокус на странице', '--color-focus', '--color-bg', 3],
    ['Фокус на блоке обращения', '--color-focus', '--color-bg-alt', 3],
    ['Фокус на тёмном', '--color-focus-on-dark', '--color-bg-dark', 3],
    ['Недоступный элемент (освобождён, для справки)', '--color-disabled-text', '--color-disabled-bg', 3],
    ['Accent на светлом: не использовать для текста и смысла', '--color-accent', '--color-bg', 3, true]
  ];
  var tb = $('#sg-contrast');
  if (tb) pairs.forEach(function (p) {
    var f = tok(p[1]), b = tok(p[2]);
    if (!isHex(f) || !isHex(b)) return;
    var r = ratio(f, b), ok = r >= p[3], info = p[4] === true;
    var tr = el('tr', null, '<td>' + p[0] + '</td><td><code>' + p[1] + '</code> / <code>' + p[2] + '</code></td><td>' + r.toFixed(2).replace('.', ',') + ' : 1</td><td>≥ ' + String(p[3]).replace('.', ',') + '</td><td class="' + (info ? '' : ok ? 'sg-ok' : 'sg-bad') + '">' + (info ? 'справка: запрещено как носитель смысла' : ok ? 'проходит' : 'не проходит') + '</td>');
    tb.appendChild(tr);
  });

  /* ---------- типографика ---------- */
  var types = [
    ['display', 'Display', 'Связь Энергострой', 'H1 главной (hero)', '--ls-display'],
    ['h1', 'H1', 'Таможенно-логистический терминал', 'H1 внутренних страниц', '--ls-h1'],
    ['h2', 'H2', 'Мы рады сотрудничать с Вами!', 'заголовок секции', '--ls-h2'],
    ['lead', 'Lead', 'многопрофильная строительно-монтажная организация', 'тезис «О компании»', '--ls-lead'],
    ['h3', 'H3', 'ООО «Связь Энергострой»', 'подзаголовок, заголовок в тексте', '--ls-h3'],
    ['h4', 'H4 / название карточки', 'Монтаж объектов видеонаблюдения', 'услуга, проект, строка списка', '--ls-h4'],
    ['body-lg', 'Body large', 'Проектирование и строительство инженерных сетей', 'вводный текст, hero', null],
    ['body', 'Body', 'Многопрофильная строительно-монтажная организация, осуществляющая комплекс работ по проектированию и строительству инженерных сетей.', 'основной текст', null],
    ['body-sm', 'Body small', 'Нажимая кнопку "Отправить" вы соглашаетесь с Политикой конфиденциальности', 'вторичный текст, ошибки, согласие', null],
    ['caption', 'Caption', 'Место для фотографии · 16 : 10', 'подписи, чипы, демо-полоса', null],
    ['label', 'Label', 'Ваш телефон', 'подпись поля', null],
    ['button', 'Button', 'Заказать звонок', 'кнопки (sm 14 · base 15 · lg 16)', '--ls-button'],
    ['nav', 'Navigation', 'Услуги Проекты О компании Контакты', 'меню', null]
  ];
  var th = $('#sg-types');
  function sizeAt(expr, w) {
    var m = expr.match(/clamp\(\s*([\d.]+)px\s*,\s*([\d.]+)vw\s*,\s*([\d.]+)px\s*\)/);
    if (m) return Math.min(Math.max(parseFloat(m[1]), parseFloat(m[2]) * w / 100), parseFloat(m[3]));
    var p = expr.match(/([\d.]+)px/); return p ? parseFloat(p[1]) : NaN;
  }
  if (th) types.forEach(function (t) {
    var raw = tok('--type-' + t[0]);
    var m = raw.match(/^(\d+)\s+(clamp\([^)]*\)|[\d.]+px)\/([\d.]+)\s+(.*)$/);
    var meta = '', family = '';
    if (m) {
      family = m[4].indexOf('Manrope') === 0 || m[4].indexOf('"Manrope"') === 0 ? 'Manrope' : 'Golos Text';
      var s390 = sizeAt(m[2], 390), s768 = sizeAt(m[2], 768), s1440 = sizeAt(m[2], 1440);
      var sizes = (s390 === s1440) ? Math.round(s390) + ' px' : Math.round(s390) + ' → ' + Math.round(s1440) + ' px (390 / 768 / 1440: ' + Math.round(s390) + ' / ' + Math.round(s768) + ' / ' + Math.round(s1440) + ')';
      var ls = t[4] ? tok(t[4]) : '0';
      meta = '<b>' + t[1] + '</b> · ' + family + ' ' + m[1] + ' · ' + sizes + ' · интерлиньяж ' + m[3].replace('.', ',') + ' · трекинг ' + ls + ' · <code>--type-' + t[0] + '</code> — ' + t[3];
    }
    var row = el('div', 'sg-type');
    var s = el('div', 'sg-type__s', t[2]);
    s.style.font = 'var(--type-' + t[0] + ')';
    if (t[4]) s.style.letterSpacing = 'var(' + t[4] + ')';
    if (t[0] === 'button' || t[0] === 'nav') s.style.whiteSpace = 'normal';
    row.appendChild(s); row.appendChild(el('div', 'sg-type__m', meta));
    th.appendChild(row);
  });

  /* ---------- отступы ---------- */
  var sp = $('#sg-space');
  if (sp) [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16].forEach(function (n) {
    var d = el('div', 'sg-space');
    d.innerHTML = '<i style="width:var(--space-' + n + ')"></i><span><code>--space-' + n + '</code> ' + tok('--space-' + n) + '</span>';
    sp.appendChild(d);
  });

  /* ---------- метаданные окна ---------- */
  var vp = $('#sg-vp');
  var upd = function () { if (vp) vp.textContent = window.innerWidth + ' px'; };
  upd(); window.addEventListener('resize', upd);
})();

/* СЭС — общее поведение (PHASE 4): шапка, меню-шторка, диалоги, демо-форма.
   Без сетевых запросов, без хранения данных, без аналитики. Все элементы необязательны: страница может содержать любое подмножество. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var header = $('[data-header]');
  var menu = $('#menu');
  var request = $('#request');
  var notice = $('#notice');
  var lastTrigger = null;

  /* ----- Шапка: прозрачная над hero, светлая после прокрутки ----- */
  /* data-header="solid" — внутренние страницы без hero: шапка светлая всегда */
  if (header) {
    var always = header.getAttribute('data-header') === 'solid';
    var syncHeader = function () {
      header.classList.toggle('is-solid', always || window.scrollY > 24);
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  /* ----- Диалоги ----- */
  function openDialog(d, trigger) {
    lastTrigger = trigger || document.activeElement;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }
  function closeDialog(d) {
    if (d.open) d.close();
  }
  [menu, request, notice].filter(Boolean).forEach(function (d) {
    d.addEventListener('close', function () {
      if (d === request) resetForm($('form', d));
      if (lastTrigger && document.contains(lastTrigger) && lastTrigger.offsetParent !== null) lastTrigger.focus();
    });
    d.addEventListener('click', function (e) {
      if (e.target === d) closeDialog(d); /* клик по фону */
    });
  });
  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeDialog(b.closest('dialog')); });
  });

  /* Меню (на узких экранах); без JS бургер — якорь на навигацию в футере */
  $$('[data-open-menu]').forEach(function (a) {
    a.addEventListener('click', function (e) { if (!menu) return; e.preventDefault(); openDialog(menu, a); });
  });
  /* Пункты меню — якоря: закрыть шторку и дать браузеру перейти */
  $$('#menu a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () { lastTrigger = null; });
  });

  /* Заявка (демо) */
  var ctxEl = $('#req-context');
  $$('[data-open-request]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!request) return;
      var subject = b.getAttribute('data-subject');
      if (subject && ctxEl) {
        ctxEl.textContent = (b.getAttribute('data-context') || 'Тема') + ': ' + subject;
        ctxEl.hidden = false;
      } else if (ctxEl) {
        ctxEl.textContent = '';
        ctxEl.hidden = true;
      }
      /* если нажато в меню — после закрытия меню фокус вернётся на кнопку диалога заявки */
      var inMenu = !!b.closest('#menu');
      openDialog(request, inMenu ? $('[data-open-menu]') : b);
      var first = $('input', request);
      if (first) first.focus();
    });
  });

  /* Уведомление о демо-ограничении (страницы, которых нет в прототипе) */
  $$('[data-notice]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!notice) return;
      $('#notice-what').textContent = 'Здесь будет: ' + b.getAttribute('data-notice') + '.';
      openDialog(notice, b);
    });
  });

  /* ----- Демо-форма: ничего не отправляется и не сохраняется ----- */
  var MSG = 'Это демонстрация. Заявка не отправлена, введённые данные не сохранены';
  var ERR = {
    name: 'Укажите имя',
    phone: 'Укажите телефон',
    phoneBad: 'Проверьте номер: нужно не меньше 10 цифр',
    email: 'Проверьте адрес e-mail'
  };

  function setErr(input, text) {
    var err = $('#' + input.id + '-err');
    if (!err) return;
    if (text) {
      err.textContent = text;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
    } else {
      err.hidden = true;
      err.textContent = '';
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function validate(form) {
    var firstBad = null;
    $$('input[data-field]', form).forEach(function (i) {
      var v = i.value.trim(), t = '';
      var k = i.getAttribute('data-field');
      if (k === 'name' && !v) t = ERR.name;
      if (k === 'phone') {
        if (!v) t = ERR.phone;
        else if (v.replace(/\D/g, '').length < 10) t = ERR.phoneBad;
      }
      if (k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) t = ERR.email;
      setErr(i, t);
      if (t && !firstBad) firstBad = i;
    });
    return firstBad;
  }

  function resetForm(form) {
    if (!form) return;
    form.reset();
    $$('input[data-field]', form).forEach(function (i) { setErr(i, ''); });
    var r = $('.form__result', form);
    if (r) r.textContent = '';
  }

  $$('[data-demo-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var result = $('.form__result', form);
      var bad = validate(form);
      if (bad) { result.textContent = ''; bad.focus(); return; }
      form.reset(); /* данные очищаются сразу, нигде не сохраняются */
      result.textContent = MSG; /* регион role=status уже в DOM и пуст — вывод озвучивается */
    });
    form.addEventListener('input', function (e) {
      var i = e.target;
      if (i.hasAttribute && i.hasAttribute('aria-invalid')) setErr(i, '');
      var r = $('.form__result', form);
      if (r && r.textContent) r.textContent = '';
    });
  });
})();

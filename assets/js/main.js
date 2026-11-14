(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var cfg = window.DRAGON_CONFIG || {};

  /* ---------- Footer year ---------- */
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Navigation ---------- */
  var nav = $('.nav');
  var toggle = $('#nav-toggle');
  var links = $('#primary-nav');

  function setMenu(open) {
    if (!toggle || !links) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    links.classList.toggle('is-open', open);
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    $$('a', links).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  var toTop = $('#to-top');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Active section highlight ---------- */
  if ('IntersectionObserver' in window) {
    var map = {};
    $$('.nav__links a[href^="#"]').forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          Object.keys(map).forEach(function (k) { map[k].classList.remove('is-active'); });
          map[en.target.id].classList.add('is-active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });

    /* ---------- Scroll reveal ---------- */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Pre-select service from CTA buttons ---------- */
  var serviceSelect = $('#f-service');
  $$('[data-service]').forEach(function (el) {
    el.addEventListener('click', function () {
      if (!serviceSelect) return;
      var wanted = el.getAttribute('data-service');
      for (var i = 0; i < serviceSelect.options.length; i++) {
        if (serviceSelect.options[i].text === wanted) { serviceSelect.selectedIndex = i; clearError(serviceSelect); break; }
      }
    });
  });

  /* ---------- Enquiry form ---------- */
  var form = $('#enquiry-form');
  if (!form) return;

  var alertBox = $('#form-alert');
  var successBox = $('#form-success');
  var submitBtn = $('#submit-btn');
  var resetBtn = $('#reset-btn');
  var tsToken = '';
  var tsWidgetId = null;

  var rules = {
    name: function (v) {
      if (!v) return 'Please enter your name.';
      if (v.length < 2) return 'Your name looks too short.';
      return '';
    },
    email: function (v) {
      if (!v) return 'Please enter your work email.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Please enter a valid email address.';
      return '';
    },
    phone: function (v) {
      if (!v) return 'Please enter your phone number.';
      var digits = v.replace(/\D/g, '');
      if (!/^[+\d][\d\s\-()]*$/.test(v) || digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
      return '';
    },
    service: function (v) { return v ? '' : 'Please choose a service.'; },
    message: function (v) {
      if (!v) return 'Please tell us a little about your requirement.';
      if (v.length < 10) return 'Please add a few more details (at least 10 characters).';
      return '';
    },
    consent: function (v) { return v ? '' : 'Please tick the box to continue.'; }
  };

  function fieldWrap(input) { return input.closest('.field'); }
  function errEl(input) { return document.getElementById('e-' + input.name); }
  function setError(input, msg) {
    var wrap = fieldWrap(input), el = errEl(input);
    wrap.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    if (el) { el.textContent = msg; el.hidden = false; }
  }
  function clearError(input) {
    var wrap = fieldWrap(input), el = errEl(input);
    wrap.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    if (el) { el.textContent = ''; el.hidden = true; }
  }
  function valueOf(input) {
    return input.type === 'checkbox' ? input.checked : input.value.trim();
  }
  function validateField(input) {
    var rule = rules[input.name];
    if (!rule) return true;
    var msg = rule(valueOf(input));
    if (msg) { setError(input, msg); return false; }
    clearError(input);
    return true;
  }
  function showAlert(msg) { alertBox.textContent = msg; alertBox.hidden = false; }
  function hideAlert() { alertBox.hidden = true; alertBox.textContent = ''; }

  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    if (!input) return;
    input.addEventListener('blur', function () { if (valueOf(input) !== '' && valueOf(input) !== false) validateField(input); });
    input.addEventListener('input', function () { if (fieldWrap(input).classList.contains('has-error')) validateField(input); });
    input.addEventListener('change', function () { if (fieldWrap(input).classList.contains('has-error')) validateField(input); });
  });

  /* Turnstile: load lazily when the form is near the viewport */
  function renderTurnstile() {
    if (!cfg.turnstileSiteKey || !window.turnstile || tsWidgetId !== null) return;
    tsWidgetId = window.turnstile.render('#turnstile', {
      sitekey: cfg.turnstileSiteKey,
      theme: 'dark',
      callback: function (token) { tsToken = token; },
      'expired-callback': function () { tsToken = ''; },
      'error-callback': function () { tsToken = ''; }
    });
  }
  function loadTurnstile() {
    if (!cfg.turnstileSiteKey || document.getElementById('cf-ts-script')) return;
    var s = document.createElement('script');
    s.id = 'cf-ts-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = renderTurnstile;
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    var tso = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { loadTurnstile(); tso.disconnect(); }
    }, { rootMargin: '600px 0px' });
    tso.observe(form);
  } else { loadTurnstile(); }

  function resetTurnstile() {
    tsToken = '';
    if (window.turnstile && tsWidgetId !== null) { try { window.turnstile.reset(tsWidgetId); } catch (e) { /* ignore */ } }
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-loading', on);
    submitBtn.setAttribute('aria-busy', String(on));
    $('.btn__label', submitBtn).textContent = on ? 'Sending…' : 'Send Enquiry';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideAlert();

    var firstBad = null;
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (input && !validateField(input) && !firstBad) firstBad = input;
    });
    if (firstBad) { firstBad.focus(); return; }

    if (!cfg.formEndpoint) {
      showAlert('The enquiry service is not configured yet. Please email enquiry@dragontechsolutions.com or call 044 46054287.');
      return;
    }
    if (cfg.turnstileSiteKey && !tsToken) {
      showAlert('Please wait for the spam check to finish, then press Send again.');
      loadTurnstile();
      return;
    }

    var payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      company: form.elements.company.value.trim(),
      service: form.elements.service.value,
      message: form.elements.message.value.trim(),
      consent: form.elements.consent.checked,
      website: form.elements.website.value,
      turnstileToken: tsToken
    };

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    setLoading(true);

    fetch(cfg.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, data: data }; });
    }).then(function (r) {
      if (r.status === 200 && r.data && r.data.ok) {
        form.hidden = true;
        successBox.hidden = false;
        successBox.focus();
        form.reset();
        resetTurnstile();
        return;
      }
      if (r.status === 400 && r.data && r.data.errors) {
        Object.keys(r.data.errors).forEach(function (k) {
          var input = form.elements[k];
          if (input && input.name) setError(input, r.data.errors[k]);
        });
        showAlert(r.data.message || 'Please check the highlighted fields.');
      } else if (r.status === 429) {
        showAlert('Too many requests. Please wait a few minutes and try again.');
      } else if (r.status === 403) {
        showAlert('The spam check failed. Please reload the page and try again.');
      } else {
        showAlert('Sorry, we could not send your enquiry right now. Please try again, or email enquiry@dragontechsolutions.com.');
      }
      resetTurnstile();
    }).catch(function () {
      showAlert('Network problem. Please check your connection and try again, or email enquiry@dragontechsolutions.com.');
      resetTurnstile();
    }).then(function () {
      if (timer) clearTimeout(timer);
      setLoading(false);
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      successBox.hidden = true;
      form.hidden = false;
      hideAlert();
      form.elements.name.focus();
    });
  }
})();

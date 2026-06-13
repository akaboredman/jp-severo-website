'use strict';

/* ── Mobile nav ───────────────────────────────────── */
const navToggle = document.getElementById('nav-toggle');
const navMenu   = document.getElementById('nav-menu');

if (navToggle && navMenu) {
  navToggle.addEventListener('click', function () {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navMenu.classList.toggle('is-open', !open);
  });

  // Close on link click
  navMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navToggle.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('is-open');
    });
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
      navToggle.setAttribute('aria-expanded', 'false');
      navMenu.classList.remove('is-open');
    }
  });
}

/* ── Contact form → WhatsApp ──────────────────────── */
const form = document.getElementById('contact-form');

if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    let valid = true;

    function getVal(id) {
      return (form.querySelector('#' + id) || {}).value || '';
    }
    function showError(id, msg) {
      const el = document.getElementById(id + '-error');
      const input = document.getElementById(id);
      if (el) el.textContent = msg;
      if (input) input.classList.add('is-invalid');
      valid = false;
    }
    function clearError(id) {
      const el = document.getElementById(id + '-error');
      const input = document.getElementById(id);
      if (el) el.textContent = '';
      if (input) input.classList.remove('is-invalid');
    }

    // Reset errors
    ['nome', 'whatsapp', 'objetivo'].forEach(clearError);

    const nome         = getVal('nome').trim();
    const whatsapp     = getVal('whatsapp').trim();
    const nivel        = getVal('nivel') || 'Não informado';
    const objetivo     = getVal('objetivo');
    const disponibilidade = getVal('disponibilidade').trim() || 'Não informado';

    if (!nome)     showError('nome',     'Por favor, informe seu nome.');
    if (!whatsapp) showError('whatsapp', 'Por favor, informe seu WhatsApp.');
    if (!objetivo) showError('objetivo', 'Por favor, selecione seu principal objetivo.');

    if (!valid) return;

    const msg =
      'Olá, JP! Me chamo ' + nome + '.\n\n' +
      'Nível de inglês: ' + nivel + '\n' +
      'Objetivo: ' + objetivo + '\n' +
      'Disponibilidade: ' + disponibilidade + '\n\n' +
      'Gostaria de agendar uma aula experimental!';

    window.open(
      'https://wa.me/5521972004450?text=' + encodeURIComponent(msg),
      '_blank',
      'noopener,noreferrer'
    );
  });

  // Live validation feedback
  form.querySelectorAll('[required]').forEach(function (input) {
    input.addEventListener('blur', function () {
      const id = input.id;
      const errEl = document.getElementById(id + '-error');
      if (!input.value.trim()) {
        input.classList.add('is-invalid');
        if (errEl) errEl.textContent = 'Este campo é obrigatório.';
      } else {
        input.classList.remove('is-invalid');
        if (errEl) errEl.textContent = '';
      }
    });
    input.addEventListener('input', function () {
      if (input.value.trim()) {
        input.classList.remove('is-invalid');
        const errEl = document.getElementById(id + '-error');
        if (errEl) errEl.textContent = '';
      }
    });
  });
}

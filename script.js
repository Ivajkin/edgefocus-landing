// The English page remains usable before JavaScript and without browser storage.
document.addEventListener('DOMContentLoaded', () => {
  const copy = window.EDGEFOCUS_COPY;
  if (!copy) return;
  const supported = ['en', 'ru', 'ar', 'zh'];
  const select = document.querySelector('#language-select');
  const params = new URLSearchParams(location.search);
  let saved;
  try { saved = localStorage.getItem('edgefocus-lang'); } catch (_) { /* Optional preference. */ }
  const browserLanguage = (navigator.language || 'en').split('-')[0].toLowerCase();
  let language = [params.get('lang'), saved, browserLanguage, 'en'].find(value => supported.includes(value));
  let unblocked = false;
  const toggle = document.querySelector('#demo-toggle');
  const status = document.querySelector('#demo-status');
  const result = document.querySelector('#demo-result');
  const workspace = document.querySelector('.demo-workspace');

  function translate() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    select.value = language;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const text = copy[language][element.dataset.i18n];
      if (typeof text === 'string') element.textContent = text;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
      element.setAttribute('aria-label', copy[language][element.dataset.i18nAria]);
    });
    document.querySelectorAll('[data-i18n-content]').forEach(element => {
      element.setAttribute('content', copy[language][element.dataset.i18nContent]);
    });
    const canonical = 'https://landing.edgefocus.ru/' + (language === 'en' ? '' : '?lang=' + language);
    document.querySelector('link[rel="canonical"]').href = canonical;
    document.querySelector('meta[property="og:url"]').content = canonical;
  }

  select.addEventListener('change', () => {
    if (!supported.includes(select.value)) return;
    language = select.value;
    try { localStorage.setItem('edgefocus-lang', language); } catch (_) { /* Navigation still works. */ }
    const url = new URL(location.href);
    url.searchParams.set('lang', language);
    history.replaceState(null, '', url);
    translate();
  });

  toggle.addEventListener('click', () => {
    unblocked = !unblocked;
    toggle.setAttribute('aria-pressed', String(unblocked));
    toggle.dataset.i18n = unblocked ? 'demoReset' : 'demoButton';
    status.dataset.i18n = unblocked ? 'demoReady' : 'demoBlocked';
    result.hidden = !unblocked;
    workspace.classList.toggle('is-unblocked', unblocked);
    translate();
    document.dispatchEvent(new CustomEvent('edgefocus:demo'));
  });
  translate();
});

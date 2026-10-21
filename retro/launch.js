(() => {
  'use strict';

  const CANONICAL = 'https://landing.edgefocus.ru/retro/';
  const CAMPAIGN = 'edgefocus-retro-202610';
  const SOURCES = ['telegram', 'linkedin', 'youtube', 'instagram', 'x', 'facebook', 'edgefocus', 'share', 'ivaikin', 'retro'];
  const MEDIUMS = ['social', 'referral', 'website', 'organic'];
  const PLACEMENTS = ['hero', 'header', 'footer', 'plans', 'page', 'demo'];
  const EVENTS = ['retro_view', 'retro_organize', 'retro_signup_click', 'retro_plans_click', 'retro_share_action'];
  const POSTHOG_ENDPOINT = 'https://eu.i.posthog.com/i/v0/e/';
  // Public project ingestion key already used by the main EdgeFocus landing.
  const POSTHOG_KEY = 'phc_yamNjvPL6xs99uxuSIki6h463eiqlewsNoV5IeTRwAT';
  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    const incoming = new URLSearchParams(window.location.search);
    const qa = [...incoming.keys()].some(key => ['qa', 'audit', 'verify', 'deploy'].includes(key.toLowerCase()));
    const toggle = document.querySelector('#analytics-toggle');
    const analyticsStatus = document.querySelector('#analytics-status');
    const shareButton = document.querySelector('#share-page');
    const shareStatus = document.querySelector('#share-status');
    let enabled = false;
    let distinctId = null;
    let sharing = false;
    let deliveryFailed = false;

    const language = () => document.documentElement.lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    const localize = (en, ru) => language() === 'ru' ? ru : en;
    const placement = value => PLACEMENTS.includes(value) ? value : 'page';
    const privacySignal = () => navigator.globalPrivacyControl === true || ['1', 'yes'].includes(String(navigator.doNotTrack || window.doNotTrack || '').toLowerCase());
    const blocked = () => qa || window.location.origin !== 'https://landing.edgefocus.ru' || privacySignal();

    function updateAnalyticsStatus() {
      const unavailable = blocked();
      if (unavailable) enabled = false;
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.disabled = unavailable;
      }
      if (!analyticsStatus) return;
      if (qa || window.location.origin !== 'https://landing.edgefocus.ru') {
        analyticsStatus.textContent = localize('Analytics off for this preview. No events sent to PostHog.', 'Аналитика отключена в предпросмотре. События не отправляются в PostHog.');
      } else if (privacySignal()) {
        analyticsStatus.textContent = localize('Analytics off. Your browser privacy preference is respected.', 'Аналитика отключена согласно настройкам приватности браузера.');
      } else if (!enabled) {
        analyticsStatus.textContent = localize('Analytics off. Optional events are not sent to PostHog.', 'Аналитика отключена. Необязательные события не отправляются в PostHog.');
      } else if (deliveryFailed) {
        analyticsStatus.textContent = localize('Analytics enabled; PostHog delivery is unavailable.', 'Аналитика включена; отправка в PostHog недоступна.');
      } else {
        analyticsStatus.textContent = localize('Analytics on: basic events to PostHog. No demo text.', 'Аналитика включена: базовые события в PostHog. Без текста заметок.');
      }
    }

    function track(event, location) {
      if (blocked()) { updateAnalyticsStatus(); return; }
      if (!enabled || !EVENTS.includes(event) || !distinctId) return;
      const payload = {
        api_key: POSTHOG_KEY,
        event,
        properties: {
          distinct_id: distinctId,
          product: 'edgefocus',
          campaign: CAMPAIGN,
          language: language(),
          placement: placement(location),
          $process_person_profile: false,
          $geoip_disable: true,
          $ip: null
        }
      };
      // No SDK, autocapture, replay, cookies, URL, referrer, input or DOM content.
      // The in-memory ID and consent disappear when this page is reloaded.
      try {
        Promise.resolve(window.fetch(POSTHOG_ENDPOINT, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          keepalive: true,
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        })).then(response => {
          if (!response.ok) throw new Error('Analytics unavailable');
          deliveryFailed = false;
          updateAnalyticsStatus();
        }).catch(() => {
          deliveryFailed = true;
          updateAnalyticsStatus();
        });
      } catch (_) {
        deliveryFailed = true;
        updateAnalyticsStatus();
      }
    }

    document.querySelectorAll('a[data-retro-action]').forEach(anchor => {
      const action = anchor.dataset.retroAction;
      if (!['signup', 'plans'].includes(action)) return;
      const url = new URL(action === 'signup' ? 'https://edgefocus.ru/register' : 'https://edgefocus.ru/subscribe');
      const source = incoming.get('utm_source');
      const medium = incoming.get('utm_medium');
      url.searchParams.set('utm_source', SOURCES.includes(source) ? source : 'retro');
      url.searchParams.set('utm_medium', MEDIUMS.includes(medium) ? medium : 'website');
      url.searchParams.set('utm_campaign', CAMPAIGN);
      url.searchParams.set('utm_content', placement(anchor.dataset.retroPlacement));
      if (qa) url.searchParams.set('qa', '1');
      anchor.href = url.href;
      anchor.addEventListener('click', () => track(action === 'signup' ? 'retro_signup_click' : 'retro_plans_click', anchor.dataset.retroPlacement));
    });

    toggle?.addEventListener('click', () => {
      if (blocked()) { updateAnalyticsStatus(); return; }
      if (enabled) {
        enabled = false;
        distinctId = null;
        updateAnalyticsStatus();
        return;
      }
      try {
        distinctId = `retro-${window.crypto.randomUUID()}`;
      } catch (_) {
        if (analyticsStatus) analyticsStatus.textContent = localize('Analytics off: a private session ID is unavailable.', 'Аналитика отключена: не удалось создать временный идентификатор.');
        return;
      }
      enabled = true;
      deliveryFailed = false;
      updateAnalyticsStatus();
      track('retro_view', 'page');
    });

    // The demo dispatches this semantic event only after its organized state changes.
    // Its detail is deliberately unread so notes can never become event properties.
    document.addEventListener('edgefocus:retro-organize', () => track('retro_organize', 'demo'));
    document.addEventListener('edgefocus:locale', updateAnalyticsStatus);

    shareButton?.addEventListener('click', async () => {
      if (sharing) return;
      sharing = true;
      shareButton.disabled = true;
      const url = new URL(language() === 'ru' ? 'ru/' : './', CANONICAL);
      url.searchParams.set('utm_source', 'share');
      url.searchParams.set('utm_medium', 'referral');
      url.searchParams.set('utm_campaign', CAMPAIGN);
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share({title: localize('EdgeFocus — Retro edition', 'EdgeFocus — ретро-версия'), url: url.href});
          if (shareStatus) shareStatus.textContent = localize('Shared through your device.', 'Отправлено через ваше устройство.');
        } else {
          if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Sharing unavailable');
          await navigator.clipboard.writeText(url.href);
          if (shareStatus) shareStatus.textContent = localize('Link copied. Paste it wherever you like.', 'Ссылка скопирована. Вставьте её, куда хотите.');
        }
        track('retro_share_action', 'footer');
      } catch (error) {
        if (shareStatus) shareStatus.textContent = error?.name === 'AbortError'
          ? localize('Sharing cancelled.', 'Отправка отменена.')
          : localize('Sharing unavailable. Copy this link: ', 'Не удалось поделиться. Скопируйте ссылку: ') + url.href;
      } finally {
        sharing = false;
        shareButton.disabled = false;
      }
    });

    updateAnalyticsStatus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();

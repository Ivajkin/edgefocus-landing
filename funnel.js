// Landing attribution and semantic funnel events. Navigation never depends on analytics.
(function (window, document) {
    'use strict';

    const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid', 'fbclid'];
    const ACTIONS = ['signup', 'login', 'demo', 'contact', 'plans'];
    const PLACEMENTS = ['nav', 'hero', 'demo', 'pricing', 'footer', 'page', 'team'];
    const LOCALES = ['en', 'ru', 'ar', 'zh'];
    const QA_MARKERS = ['qa', 'audit', 'verify', 'deploy'];
    let initialized = false;

    function placement(value) {
        return PLACEMENTS.includes(value) ? value : 'unknown';
    }

    function track(name, location, action) {
        const language = String(document.documentElement.lang || '').split('-')[0].toLowerCase();
        const properties = {
            page_version: '2026-10-conversion',
            placement: placement(location),
            locale: LOCALES.includes(language) ? language : 'en',
            action,
        };

        // The local queue also makes preview QA inspectable without transmitting data.
        try {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({event: name, ...properties});
        } catch (_) { /* Analytics must not affect the page. */ }

        const query = new URLSearchParams(window.location.search);
        if (window.location.hostname !== 'landing.edgefocus.ru' || QA_MARKERS.some(key => query.has(key))) return;
        try {
            if (typeof window.posthog?.capture === 'function') window.posthog.capture(name, properties);
        } catch (_) { /* One unavailable provider must not disable the other. */ }
        try {
            if (typeof window.ym === 'function') window.ym(108284737, 'reachGoal', name, properties);
        } catch (_) { /* Navigation and the demo work with analytics blocked. */ }
    }

    function updateAppLinks() {
        const incoming = new URLSearchParams(window.location.search);
        document.querySelectorAll('a[href]').forEach(anchor => {
            const action = anchor.dataset.cta;
            let url;
            try {
                const destination = action === 'signup' ? 'https://edgefocus.ru/register'
                    : action === 'login' ? 'https://edgefocus.ru/login' : anchor.href;
                url = new URL(destination, window.location.href);
            } catch (_) { return; }

            // Exact origin, with no embedded credentials. Never forward to a lookalike.
            if (url.origin !== 'https://edgefocus.ru' || url.username || url.password) return;

            CAMPAIGN_KEYS.forEach(key => {
                const value = incoming.get(key);
                if (value) url.searchParams.set(key, value);
            });
            const defaults = {
                utm_source: 'landing',
                utm_medium: 'website',
                utm_campaign: 'edgefocus',
                utm_content: placement(anchor.dataset.location),
            };
            Object.entries(defaults).forEach(([key, value]) => {
                if (!url.searchParams.get(key)) url.searchParams.set(key, value);
            });
            anchor.href = url.toString();
        });
    }

    function init() {
        if (initialized) return;
        initialized = true;
        updateAppLinks();
        track('landing_view', 'page', 'view');

        document.addEventListener('click', event => {
            const anchor = event.target?.closest?.('a[data-cta]');
            const action = anchor?.dataset.cta;
            if (ACTIONS.includes(action)) track('cta_click', anchor.dataset.location, action);
        });

        // The illustration dispatches this after changing state; ignore arbitrary detail.
        document.addEventListener('edgefocus:demo', () => track('demo_interaction', 'demo', 'toggle'));

        const pricing = document.querySelector('#pricing');
        if (pricing && typeof window.IntersectionObserver === 'function') {
            let viewed = false;
            const observer = new window.IntersectionObserver(entries => {
                if (viewed || !entries.some(entry => entry.isIntersecting)) return;
                viewed = true;
                track('pricing_view', 'pricing', 'view');
                observer.disconnect();
            }, {threshold: 0.15});
            observer.observe(pricing);
        }
    }

    // Deferred scripts run while readyState is interactive, before the locale's
    // DOMContentLoaded listener. Wait so the first view uses the rendered locale.
    if (document.readyState === 'complete') init();
    else document.addEventListener('DOMContentLoaded', init, {once: true});
})(window, document);

// Landing attribution and semantic funnel events. Navigation never depends on analytics.
(function (window, document) {
    'use strict';

    const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid', 'fbclid'];
    const ACTIONS = ['signup', 'login', 'demo', 'contact', 'plans', 'eva', 'developer', 'partner', 'partner-apply'];
    const PLACEMENTS = ['nav', 'hero', 'demo', 'pricing', 'footer', 'page', 'team'];
    const LOCALES = ['en', 'ru', 'ar', 'zh'];
    const QA_MARKERS = ['qa', 'audit', 'verify', 'deploy'];
    const INTENTS = ['eva', 'developer'];
    const PRODUCTS = [...INTENTS, 'partner'];
    const LAUNCH_CAMPAIGN = 'eva-agenthub-launch-202610';
    const PARTNER_CAMPAIGN = 'edge-partners-202610';
    let initialized = false;

    function placement(value) {
        return PLACEMENTS.includes(value) ? value : 'unknown';
    }

    function track(name, location, action, product) {
        const language = String(document.documentElement.lang || '').split('-')[0].toLowerCase();
        const properties = {
            page_version: '2026-10-conversion',
            placement: placement(location),
            locale: LOCALES.includes(language) ? language : 'en',
            action,
        };
        const pageProduct = document.documentElement.dataset?.product;
        const selectedProduct = PRODUCTS.includes(product) ? product : pageProduct;
        if (PRODUCTS.includes(selectedProduct)) {
            properties.product = selectedProduct;
            properties.release = selectedProduct === 'partner' ? PARTNER_CAMPAIGN : LAUNCH_CAMPAIGN;
        }

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
            const intent = INTENTS.includes(anchor.dataset.intent) ? anchor.dataset.intent : null;
            const productLink = PRODUCTS.includes(anchor.dataset.productLink) ? anchor.dataset.productLink : null;
            let url;
            try {
                const destination = action === 'signup' ? 'https://edgefocus.ru/register'
                    : action === 'login' ? 'https://edgefocus.ru/login' : anchor.href;
                url = new URL(destination, window.location.href);
            } catch (_) { return; }

            if (productLink && url.origin === window.location.origin) {
                const language = ['ru', 'en'].includes(anchor.dataset.productLanguage)
                    ? anchor.dataset.productLanguage : document.documentElement.lang === 'ru' ? 'ru' : 'en';
                url.pathname = '/' + language + '/' + ({eva:'eva',developer:'developers',partner:'partners'}[productLink]) + '/';
            }

            if (action === 'partner-apply') {
                if (url.origin !== 'https://edgeivaikin.com' || url.username || url.password || !['/partners/', '/ru/partners/'].includes(url.pathname)) return;
                url.search = '';
                const track = anchor.dataset.partnerTrack;
                if (['referral', 'delivery', 'technology'].includes(track)) url.searchParams.set('track', track);
                const source = incoming.get('utm_source');
                url.searchParams.set('utm_source', ['edgefocus', 'edgeivaikin', 'ivaikin', 'telegram', 'linkedin', 'direct'].includes(source) ? source : 'edgefocus');
                url.searchParams.set('utm_medium', incoming.get('utm_medium') === 'organic_social' ? 'organic_social' : 'website');
                url.searchParams.set('utm_campaign', PARTNER_CAMPAIGN);
                url.searchParams.set('utm_content', ['hero','page','footer','apply'].includes(anchor.dataset.location) ? anchor.dataset.location : 'page');
                if (QA_MARKERS.some(key => incoming.has(key))) url.searchParams.set('qa', '1');
                anchor.href = url.toString();
                return;
            }

            if (intent || productLink) {
                if (url.username || url.password) return;
                if (intent && url.origin !== 'https://edgefocus.ru') return;
                if (productLink && url.origin !== window.location.origin) return;
                // Product launch links carry only declared campaign values. Never
                // propagate arbitrary identifiers, redirect URLs or query text.
                url.search = '';
                if (intent) url.searchParams.set('intent', intent);
                const source = incoming.get('utm_source');
                const medium = incoming.get('utm_medium');
                const partnerPage = productLink === 'partner';
                const sources = partnerPage ? ['edgefocus', 'edgeivaikin', 'ivaikin', 'telegram', 'linkedin', 'direct'] : ['telegram', 'linkedin', 'landing', 'direct'];
                url.searchParams.set('utm_source', sources.includes(source) ? source : (partnerPage ? 'edgefocus' : 'landing'));
                url.searchParams.set('utm_medium', medium === 'organic_social' ? 'organic_social' : 'website');
                url.searchParams.set('utm_campaign', productLink === 'partner' ? PARTNER_CAMPAIGN : LAUNCH_CAMPAIGN);
                url.searchParams.set('utm_content', placement(anchor.dataset.location));
                if (QA_MARKERS.some(key => incoming.has(key))) url.searchParams.set('qa', '1');
                anchor.href = url.toString();
                return;
            }

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
            if (ACTIONS.includes(action)) track('cta_click', anchor.dataset.location, action, anchor.dataset.intent || anchor.dataset.productLink);
        });

        document.addEventListener('edgefocus:locale', updateAppLinks);

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

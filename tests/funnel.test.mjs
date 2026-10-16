import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sourcePath = new URL('../funnel.js', import.meta.url);
const source = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : '';

function anchor(href, cta = '', placement = 'hero') {
    return {
        href,
        dataset: {cta, location: placement},
        getAttribute(name) { return name === 'href' ? this.href : null; },
        closest(selector) { return selector === 'a[data-cta]' && this.dataset.cta ? this : null; },
    };
}

function browser({hostname = 'landing.edgefocus.ru', search = '', anchors = [], readyState = 'complete', locale = 'ru', product = ''} = {}) {
    const listeners = new Map();
    const posthogEvents = [];
    const metrikaEvents = [];
    let pricingObserver;
    const pricing = {id: 'pricing'};
    const document = {
        readyState,
        documentElement: {lang: locale, dataset: {product}},
        querySelectorAll(selector) { return selector === 'a[href]' ? anchors : []; },
        querySelector(selector) { return selector === '#pricing' ? pricing : null; },
        addEventListener(name, handler) {
            listeners.set(name, [...(listeners.get(name) || []), handler]);
        },
    };
    const window = {
        document,
        location: {hostname, search, origin: `https://${hostname}`, href: `https://${hostname}/${search}`},
        posthog: {capture: (...args) => posthogEvents.push(args)},
        ym: (...args) => metrikaEvents.push(args),
        IntersectionObserver: class {
            constructor(callback) { this.callback = callback; pricingObserver = this; }
            observe(target) { this.target = target; }
            disconnect() { this.disconnected = true; }
        },
    };
    Object.defineProperty(window, 'localStorage', {get() { throw new Error('Storage blocked'); }});
    vm.runInNewContext(source, {window, document, URL, URLSearchParams});
    return {
        window, document, posthogEvents, metrikaEvents,
        fire(name, event = {}) { for (const handler of listeners.get(name) || []) handler(event); },
        showPricing() {
            assert.ok(pricingObserver, 'pricing view observer must be installed');
            pricingObserver.callback([{isIntersecting: true, target: pricing}]);
        },
    };
}

test('signup and login CTAs reach their intended app entry points without an extra login step', () => {
    const signup = anchor('https://edgefocus.ru/', 'signup');
    const login = anchor('https://edgefocus.ru/', 'login', 'nav');
    browser({anchors: [signup, login]});
    assert.equal(new URL(signup.href).pathname, '/register');
    assert.equal(new URL(login.href).pathname, '/login');
    assert.equal(new URL(signup.href).searchParams.get('utm_content'), 'hero');
    assert.equal(new URL(login.href).searchParams.get('utm_content'), 'nav');
});

test('app links preserve campaign attribution and exclude redirect and unapproved query data', () => {
    const signup = anchor('https://edgefocus.ru/', 'signup', 'footer');
    browser({anchors: [signup], search: '?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=issue-5&utm_term=focus&yclid=11&gclid=22&fbclid=33&redirect=https%3A%2F%2Fevil.test&email=person%40example.com&utm_private=secret'});
    assert.deepEqual(Object.fromEntries(new URL(signup.href).searchParams), {
        utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'launch',
        utm_content: 'issue-5', utm_term: 'focus', yclid: '11', gclid: '22', fbclid: '33',
    });
});

test('direct traffic receives a stable landing campaign without manufacturing click IDs', () => {
    const signup = anchor('https://edgefocus.ru/register', 'signup', 'pricing');
    browser({anchors: [signup]});
    assert.deepEqual(Object.fromEntries(new URL(signup.href).searchParams), {
        utm_source: 'landing', utm_medium: 'website', utm_campaign: 'edgefocus', utm_content: 'pricing',
    });
});

test('attribution never rewrites lookalike hosts, subdomains, credential URLs, or external contact links', () => {
    const originals = [
        'https://edgefocus.ru.evil.test/', 'https://staging.edgefocus.ru/',
        'https://edgefocus.ru@evil.test/', 'https://user@edgefocus.ru/',
        'http://edgefocus.ru/', 'https://t.me/TimothyIvaikin', '#demo',
    ];
    const anchors = originals.map(url => anchor(url));
    browser({anchors, search: '?utm_source=mail'});
    assert.deepEqual(anchors.map(a => a.href), originals);
});

test('ordinary app links keep their destination while getting allowlisted attribution', () => {
    const pricing = anchor('https://edgefocus.ru/user/settings/billing?plan=pro_month', '', 'pricing');
    browser({anchors: [pricing], search: '?utm_source=partner'});
    const result = new URL(pricing.href);
    assert.equal(result.pathname, '/user/settings/billing');
    assert.equal(result.searchParams.get('plan'), 'pro_month');
    assert.equal(result.searchParams.get('utm_source'), 'partner');
});

test('production emits a landing view with only the fixed privacy-safe event schema', () => {
    const page = browser({search: '?email=person%40example.com&redirect=secret'});
    assert.equal(page.posthogEvents.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(page.posthogEvents[0])), ['landing_view', {
        page_version: '2026-10-conversion', placement: 'page', locale: 'ru', action: 'view',
    }]);
    assert.deepEqual(JSON.parse(JSON.stringify(page.metrikaEvents[0])), [108284737, 'reachGoal', 'landing_view', {
        page_version: '2026-10-conversion', placement: 'page', locale: 'ru', action: 'view',
    }]);
});

test('CTA clicks use current locale and placement while leaving navigation untouched', () => {
    const signup = anchor('https://edgefocus.ru/', 'signup', 'hero');
    const page = browser({anchors: [signup]});
    page.document.documentElement.lang = 'en';
    let prevented = false;
    page.fire('click', {target: {closest: () => signup}, preventDefault() { prevented = true; }});
    assert.equal(prevented, false);
    assert.equal(page.posthogEvents.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(page.posthogEvents[1])), ['cta_click', {
        page_version: '2026-10-conversion', placement: 'hero', locale: 'en', action: 'signup',
    }]);
});

test('unapproved CTA metadata cannot put free text or personal data into analytics', () => {
    const unsafe = anchor('https://example.com/', 'email:person@example.com', 'private-person');
    const known = anchor('https://edgefocus.ru/', 'signup', 'private-person');
    const page = browser({locale: 'private-locale'});
    page.fire('click', {target: unsafe});
    page.fire('click', {target: known});
    assert.equal(page.posthogEvents.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(page.posthogEvents[1][1])), {
        page_version: '2026-10-conversion', placement: 'unknown', locale: 'en', action: 'signup',
    });
});

test('demo interaction and pricing visibility are separate from CTA clicks and pricing counts once', () => {
    const page = browser();
    page.fire('edgefocus:demo', {detail: {unsafe: 'private text'}});
    page.showPricing();
    page.showPricing();
    assert.deepEqual(page.posthogEvents.map(([name]) => name), ['landing_view', 'demo_interaction', 'pricing_view']);
    assert.deepEqual(JSON.parse(JSON.stringify(page.posthogEvents[1][1])), {
        page_version: '2026-10-conversion', placement: 'demo', locale: 'ru', action: 'toggle',
    });
});

test('preview hosts never call external analytics but retain inspectable local QA events', () => {
    for (const hostname of ['localhost', '127.0.0.1', 'staging.edgefocus.ru', 'landing.edgefocus.ru.evil.test']) {
        const page = browser({hostname});
        page.fire('edgefocus:demo');
        assert.equal(page.posthogEvents.length, 0);
        assert.equal(page.metrikaEvents.length, 0);
        assert.ok(Array.isArray(page.window.dataLayer), 'local QA event queue exists');
        assert.deepEqual(Array.from(page.window.dataLayer, event => event.event), ['landing_view', 'demo_interaction']);
    }
});

test('one blocked provider cannot stop the other provider or app navigation', () => {
    const signup = anchor('https://edgefocus.ru/', 'signup');
    const page = browser({anchors: [signup]});
    page.window.posthog.capture = () => { throw new Error('Blocked PostHog'); };
    assert.doesNotThrow(() => page.fire('click', {target: signup}));
    assert.equal(page.metrikaEvents.length, 2);
    assert.equal(page.metrikaEvents.at(-1)[2], 'cta_click');
    page.window.ym = () => { throw new Error('Blocked Metrika'); };
    page.window.posthog.capture = (...args) => page.posthogEvents.push(args);
    assert.doesNotThrow(() => page.fire('edgefocus:demo'));
    assert.equal(page.posthogEvents.at(-1)[0], 'demo_interaction');
    assert.equal(new URL(signup.href).pathname, '/register');
});

test('early script loading waits for DOM readiness and initializes once', () => {
    const signup = anchor('https://edgefocus.ru/', 'signup');
    const page = browser({anchors: [signup], readyState: 'loading'});
    assert.equal(page.posthogEvents.length, 0);
    page.fire('DOMContentLoaded');
    page.fire('DOMContentLoaded');
    assert.equal(page.posthogEvents.length, 1);
    assert.equal(new URL(signup.href).pathname, '/register');
});

test('deferred loading waits for the locale initialization listener before the landing view', () => {
    const page = browser({readyState: 'interactive', locale: 'en'});
    assert.equal(page.posthogEvents.length, 0, 'defer must not measure the untranslated default locale');
    // script.js registered its DOMContentLoaded handler before funnel.js.
    page.document.documentElement.lang = 'ru';
    page.fire('DOMContentLoaded');
    assert.equal(page.posthogEvents.length, 1);
    assert.equal(page.posthogEvents[0][1].locale, 'ru');
});

test('paid-plan intent is tracked and team contact retains its actual placement', () => {
    const plans = anchor('https://edgefocus.ru/subscribe', 'plans', 'pricing');
    const contact = anchor('https://t.me/TimothyIvaikin', 'contact', 'team');
    const page = browser({anchors: [plans, contact]});
    page.fire('click', {target: plans});
    page.fire('click', {target: contact});
    assert.equal(page.posthogEvents.length, 3);
    assert.deepEqual(JSON.parse(JSON.stringify(page.posthogEvents.slice(1))), [
        ['cta_click', {page_version: '2026-10-conversion', placement: 'pricing', locale: 'ru', action: 'plans'}],
        ['cta_click', {page_version: '2026-10-conversion', placement: 'team', locale: 'ru', action: 'contact'}],
    ]);
    assert.equal(new URL(plans.href).pathname, '/subscribe');
});

test('production QA markers suppress both providers by presence and retain only safe local events', () => {
    for (const search of ['?qa', '?audit=mobile', '?verify=', '?deploy=false', '?utm_source=review&qa=0']) {
        const signup = anchor('https://edgefocus.ru/register', 'signup');
        const page = browser({search, anchors: [signup]});
        page.fire('click', {target: signup});
        page.fire('edgefocus:demo', {detail: {query: search}});
        page.showPricing();
        assert.equal(page.posthogEvents.length, 0, search);
        assert.equal(page.metrikaEvents.length, 0, search);
        assert.deepEqual(Array.from(page.window.dataLayer, event => event.event), [
            'landing_view', 'cta_click', 'demo_interaction', 'pricing_view',
        ]);
        for (const event of page.window.dataLayer) {
            assert.deepEqual(Object.keys(event).sort(), ['action', 'event', 'locale', 'page_version', 'placement']);
        }
        const target = new URL(signup.href);
        for (const marker of ['qa', 'audit', 'verify', 'deploy']) assert.equal(target.searchParams.has(marker), false);
    }
});

test('ordinary production campaigns still transmit when a marker appears only inside a value', () => {
    const page = browser({search: '?utm_campaign=deploy&source=qa&audit_note=mobile'});
    assert.equal(page.posthogEvents.length, 1);
    assert.equal(page.metrikaEvents.length, 1);
});

test('product signup and login retain their fixed intent and reject unrelated query values', () => {
    const signup = anchor('https://edgefocus.ru/register?intent=developer', 'signup');
    signup.dataset.intent = 'developer';
    const login = anchor('https://edgefocus.ru/login?intent=eva', 'login');
    login.dataset.intent = 'eva';
    browser({anchors: [signup, login], search: '?utm_source=telegram&utm_medium=organic_social&utm_campaign=eva-agenthub-launch-202610&email=private&redirect=https://evil.test&gclid=secret'});
    for (const [link, path, intent] of [[signup, '/register', 'developer'], [login, '/login', 'eva']]) {
        const url = new URL(link.href);
        assert.equal(url.pathname, path);
        assert.deepEqual(Object.fromEntries(url.searchParams), {intent, utm_source: 'telegram', utm_medium: 'organic_social', utm_campaign: 'eva-agenthub-launch-202610', utm_content: 'hero'});
    }
});

test('launch discovery links retain locale and known source across the homepage handoff', () => {
    const link = anchor('https://landing.edgefocus.ru/en/developers/', 'developer');
    link.dataset.productLink = 'developer';
    const page = browser({anchors: [link], search: '?utm_source=linkedin&utm_medium=organic_social'});
    assert.equal(new URL(link.href).pathname, '/ru/developers/');
    assert.equal(new URL(link.href).searchParams.get('utm_source'), 'linkedin');
    page.document.documentElement.lang = 'zh';
    page.fire('edgefocus:locale');
    assert.equal(new URL(link.href).pathname, '/en/developers/');
    link.dataset.productLanguage = 'ru';
    page.fire('edgefocus:locale');
    assert.equal(new URL(link.href).pathname, '/ru/developers/');
});

test('launch events use only fixed product metadata and QA stays suppressed after the app handoff', () => {
    const link = anchor('https://edgefocus.ru/register', 'signup');
    link.dataset.intent = 'eva';
    const page = browser({anchors: [link], product: 'eva', search: '?qa=0&utm_source=person%40example.com'});
    page.fire('click', {target: link});
    assert.equal(page.posthogEvents.length, 0);
    assert.equal(new URL(link.href).searchParams.get('qa'), '1');
    assert.equal(new URL(link.href).searchParams.get('utm_source'), 'landing');
    assert.equal(page.window.dataLayer[0].product, 'eva');
    assert.equal(page.window.dataLayer[1].product, 'eva');
    assert.ok(!JSON.stringify(page.window.dataLayer).includes('example.com'));
});

test('partner application links keep an explicit track and safe campaign across sites', () => {
    const link = anchor('https://edgeivaikin.com/ru/partners/?track=delivery&email=private#apply', 'partner-apply');
    link.dataset.partnerTrack = 'delivery';
    const page = browser({anchors:[link], product:'partner', search:'?utm_source=telegram&utm_medium=organic_social&qa=1&email=private&redirect=evil'});
    const url = new URL(link.href);
    assert.equal(url.origin, 'https://edgeivaikin.com');
    assert.equal(url.pathname, '/ru/partners/');
    assert.equal(url.hash, '#apply');
    assert.deepEqual(Object.fromEntries(url.searchParams), {track:'delivery',utm_source:'telegram',utm_medium:'organic_social',utm_campaign:'edge-partners-202610',utm_content:'hero',qa:'1'});
    page.fire('click',{target:link});
    assert.equal(page.posthogEvents.length,0);
    assert.equal(page.window.dataLayer[1].action,'partner-apply');
    assert.equal(page.window.dataLayer[1].release,'edge-partners-202610');
});

test('partner discovery respects locale and cannot become an unsupported signup intent', () => {
    const link = anchor('https://landing.edgefocus.ru/en/partners/', 'partner');
    link.dataset.productLink='partner';
    const signup=anchor('https://edgefocus.ru/register?intent=partner','signup');
    signup.dataset.intent='partner';
    const page=browser({anchors:[link,signup],locale:'ru'});
    assert.equal(new URL(link.href).pathname,'/ru/partners/');
    assert.equal(new URL(link.href).searchParams.get('utm_campaign'),'edge-partners-202610');
    assert.equal(new URL(signup.href).searchParams.has('intent'),false);
    page.document.documentElement.lang='ar';page.fire('edgefocus:locale');
    assert.equal(new URL(link.href).pathname,'/en/partners/');
});

test('partner attribution never rewrites an untrusted destination or sends arbitrary metadata', () => {
    const originals=['https://edgeivaikin.com.evil.test/partners/','https://user@edgeivaikin.com/partners/','http://edgeivaikin.com/partners/','https://edgeivaikin.com/unrelated/'];
    const links=originals.map(u=>anchor(u,'partner-apply'));
    browser({anchors:links,search:'?email=private&qa=1'});
    assert.deepEqual(links.map(a=>a.href),originals);
    const valid=anchor('https://edgeivaikin.com/partners/#apply','partner-apply');
    valid.dataset.partnerTrack='secret';
    browser({anchors:[valid],search:'?utm_source=person@example.com&utm_campaign=private'});
    assert.deepEqual(Object.fromEntries(new URL(valid.href).searchParams), {utm_source:'edgefocus',utm_medium:'website',utm_campaign:'edge-partners-202610',utm_content:'hero'});
});

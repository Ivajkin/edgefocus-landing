import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2].replaceAll('&amp;', '&')]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(match => attributes(match[0]));

for (const locale of ['ru', 'en']) {
  test(`${locale} partner entry reaches the canonical application and all three tracks`, () => {
    const file = new URL(`${locale}/partners/index.html`, root);
    assert.ok(existsSync(file), 'partner entry page must exist');
    const html = readFileSync(file, 'utf8');
    const links = tags(html, 'a');
    const apply = links.filter(link => link['data-cta'] === 'partner-apply');
    assert.ok(apply.some(link => link['data-location'] === 'hero'));
    assert.ok(apply.some(link => link['data-location'] === 'footer'));
    assert.deepEqual([...new Set(apply.map(link => link['data-partner-track']).filter(Boolean))].sort(), ['delivery', 'referral', 'technology']);
    for (const link of apply) {
      const url = new URL(link.href);
      assert.equal(url.origin, 'https://edgeivaikin.com');
      assert.equal(url.pathname, locale === 'ru' ? '/ru/partners/' : '/partners/');
      assert.equal(url.hash, '#apply');
      assert.equal(url.searchParams.get('utm_source'), 'edgefocus');
      assert.equal(url.searchParams.get('utm_medium'), 'website');
      assert.equal(url.searchParams.get('utm_campaign'), 'edge-partners-202610');
      assert.equal(url.searchParams.get('track'), link['data-partner-track'] || null);
      assert.ok([...url.searchParams.keys()].every(key => ['track', 'utm_source', 'utm_medium', 'utm_campaign'].includes(key)));
    }
    assert.ok(links.some(link => link.href === `/${locale}/developers/`));
    assert.ok(links.some(link => link.href === 'https://edgefocus.ru/api/v1/docs'));
    assert.ok(links.some(link => link.href === 'https://edgefocus.ru/agents'));
    assert.equal(tags(html, 'form').length, 0, 'applications belong to the canonical intake');
  });

  test(`${locale} partner entry has crawlable locale metadata and resolvable local resources`, () => {
    const file = new URL(`${locale}/partners/index.html`, root);
    assert.ok(existsSync(file), 'partner entry page must exist');
    const html = readFileSync(file, 'utf8');
    const canonical = `https://landing.edgefocus.ru/${locale}/partners/`;
    assert.equal(tags(html, 'html')[0]?.lang, locale);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.ok(tags(html, 'main').some(tag => tag.id === 'main'));
    const links = tags(html, 'link');
    assert.equal(links.find(link => link.rel === 'canonical')?.href, canonical);
    assert.equal(links.find(link => link.hreflang === 'ru')?.href, 'https://landing.edgefocus.ru/ru/partners/');
    assert.equal(links.find(link => link.hreflang === 'en')?.href, 'https://landing.edgefocus.ru/en/partners/');
    assert.equal(links.find(link => link.hreflang === 'x-default')?.href, 'https://landing.edgefocus.ru/en/partners/');
    assert.equal(tags(html, 'meta').find(meta => meta.property === 'og:url')?.content, canonical);
    for (const tag of [...tags(html, 'a'), ...links, ...tags(html, 'script'), ...tags(html, 'img')]) {
      const value = tag.src || tag.href;
      if (!value || /^(?:https?:|mailto:|#)/.test(value)) continue;
      assert.ok(existsSync(new URL(value.replace(/^\//, '').split('?')[0], root)), `missing local target ${value}`);
    }
    assert.deepEqual(tags(html, 'script').map(script => script.src), ['/analytics.js', '/funnel.js']);
  });
}

test('EVA and developer entries expose partner navigation in both locales', () => {
  for (const locale of ['ru', 'en']) for (const page of ['eva', 'developers']) {
    const links = tags(readFileSync(new URL(`${locale}/${page}/index.html`, root), 'utf8'), 'a');
    for (const location of ['nav', 'footer']) assert.ok(links.some(link => link.href === `/${locale}/partners/` && link['data-location'] === location && link['data-product-link'] === 'partner'), `${locale}/${page} missing ${location} partner link`);
  }
});

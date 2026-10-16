import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
const root = new URL('../', import.meta.url);
const pages = [
  {locale: 'ru', page: 'eva', intent: 'eva'}, {locale: 'en', page: 'eva', intent: 'eva'},
  {locale: 'ru', page: 'developers', intent: 'developer'}, {locale: 'en', page: 'developers', intent: 'developer'},
];
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2].replaceAll('&amp;', '&')]));
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map(match => attrs(match[0]));
for (const page of pages) test(`${page.locale}/${page.page} is a crawlable product entry with a complete conversion path`, () => {
  const path = `${page.locale}/${page.page}/index.html`;
  assert.ok(existsSync(new URL(path, root)), `missing ${path}`);
  const html = readFileSync(new URL(path, root), 'utf8');
  const canonical = `https://landing.edgefocus.ru/${page.locale}/${page.page}/`;
  assert.match(html, new RegExp(`<html lang="${page.locale}"`));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes('<main id="main">'));
  const links = tags(html, 'link');
  assert.equal(links.find(link => link.rel === 'canonical')?.href, canonical);
  for (const locale of ['ru', 'en']) assert.equal(links.find(link => link.hreflang === locale)?.href, `https://landing.edgefocus.ru/${locale}/${page.page}/`);
  assert.equal(links.find(link => link.hreflang === 'x-default')?.href, `https://landing.edgefocus.ru/en/${page.page}/`);
  const metadata = tags(html, 'meta');
  assert.ok(metadata.find(meta => meta.name === 'description')?.content.length > 60);
  assert.equal(metadata.find(meta => meta.property === 'og:url')?.content, canonical);
  assert.equal(metadata.find(meta => meta.property === 'og:title')?.content, html.match(/<title>([^<]+)<\/title>/)[1]);
  const anchors = tags(html, 'a');
  for (const action of ['signup', 'login']) {
    const calls = anchors.filter(anchor => anchor['data-cta'] === action);
    assert.ok(calls.length > 0, `${action} CTA missing`);
    for (const call of calls) {
      const url = new URL(call.href);
      assert.equal(url.origin, 'https://edgefocus.ru');
      assert.equal(url.pathname, action === 'signup' ? '/register' : '/login');
      assert.equal(url.searchParams.get('intent'), page.intent);
      assert.equal(url.searchParams.get('utm_campaign'), 'eva-agenthub-launch-202610');
      assert.equal(call['data-intent'], page.intent);
      assert.ok(['hero', 'footer', 'nav'].includes(call['data-location']));
    }
  }
  for (const language of ['ru', 'en']) {
    const languageLink = anchors.find(anchor => anchor.hreflang === language);
    assert.equal(languageLink?.href, `/${language}/${page.page}/`);
    assert.equal(languageLink?.['data-product-language'], language);
    assert.equal(languageLink?.['data-product-link'], page.intent);
  }
  assert.ok(anchors.some(anchor => anchor.href.startsWith('https://edgefocus.ru/subscribe')));
  if (page.intent === 'developer') assert.ok(anchors.some(anchor => anchor.href === 'https://edgefocus.ru/agents'));
  for (const tag of [...tags(html, 'a'), ...tags(html, 'link'), ...tags(html, 'script'), ...tags(html, 'img')]) {
    const value = tag.src || tag.href;
    if (!value || /^(?:https?:|mailto:|#)/.test(value)) continue;
    const target = new URL(value.replace(/^\//, '').split('?')[0], root);
    assert.ok(existsSync(target), `missing local target ${value}`);
  }
  for (const script of tags(html, 'script')) if (script.src) assert.ok(['/analytics.js', '/funnel.js'].includes(script.src), 'no new external trackers or legacy homepage-only script');
  assert.doesNotMatch(html, /50\s*(?:million|млн)|личн\S*\s+(?:прибыл|цел)|SFIT|Tamchy|семь[яеи]|billionaire|guaranteed\s+(?:buyers|income|results)|гарантирован\S*\s+(?:доход|покупател|результат)/iu);
});

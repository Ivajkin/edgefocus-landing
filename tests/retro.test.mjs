import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const origin = 'https://landing.edgefocus.ru';
const campaign = 'edgefocus-retro-202610';
const pages = [
  {locale: 'en', pathname: '/retro/', image: '/retro/assets/og-en.png'},
  {locale: 'ru', pathname: '/retro/ru/', image: '/retro/assets/og-ru.png'},
];
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)]
  .map(match => [match[1], (match[2] ?? match[3]).replaceAll('&amp;', '&')]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => attributes(match[0]));
const fileFor = pathname => new URL(pathname.replace(/^\//, ''), root);
const readPage = page => readFileSync(fileFor(`${page.pathname}index.html`), 'utf8');

function assertLocalTarget(value, pageUrl) {
  if (!value || /^(?:data:|mailto:|tel:)/i.test(value)) return;
  const url = new URL(value, pageUrl);
  if (url.origin !== origin) return;
  let target = fileFor(decodeURIComponent(url.pathname));
  assert.ok(existsSync(target), `missing local target ${url.pathname}`);
  if (statSync(target).isDirectory()) {
    target = new URL('index.html', target.href.endsWith('/') ? target : new URL(`${target.href}/`));
    assert.ok(existsSync(target), `directory has no index.html: ${url.pathname}`);
  }
  if (url.hash && /\.html$/.test(target.pathname)) {
    const body = readFileSync(target, 'utf8');
    const id = decodeURIComponent(url.hash.slice(1));
    assert.ok(tags(body, '[a-z][a-z0-9:-]*').some(tag => tag.id === id || tag.name === id),
      `missing fragment ${url.hash} in ${url.pathname}`);
  }
}

for (const page of pages) {
  test(`retro ${page.locale}: static crawlable canonical, locale and social metadata`, () => {
    const html = readPage(page);
    const links = tags(html, 'link');
    const metadata = tags(html, 'meta');
    const meta = (key, attr = 'property') => metadata.find(item => item[attr] === key)?.content;
    assert.equal(tags(html, 'html')[0]?.lang, page.locale);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1);
    assert.ok(tags(html, 'main').length > 0);
    assert.ok(html.match(/<title>([^<]+)<\/title>/i)?.[1].trim());
    assert.ok(meta('description', 'name')?.length > 50);
    assert.doesNotMatch(meta('robots', 'name') || '', /noindex|nofollow/i);
    assert.equal(links.find(link => link.rel === 'canonical')?.href, origin + page.pathname);
    for (const localePage of pages) {
      assert.equal(links.find(link => link.rel === 'alternate' && link.hreflang === localePage.locale)?.href,
        origin + localePage.pathname);
    }
    assert.equal(links.find(link => link.hreflang === 'x-default')?.href, origin + '/retro/');
    assert.equal(meta('og:url'), origin + page.pathname);
    assert.ok(meta('og:title'));
    assert.ok(meta('og:description'));
    assert.equal(meta('og:image'), origin + page.image);
    assert.equal(meta('og:image:width'), '1200');
    assert.equal(meta('og:image:height'), '630');
    assert.ok(meta('og:image:alt'));
    assert.equal(meta('twitter:card', 'name'), 'summary_large_image');
  });

  test(`retro ${page.locale}: social preview is a real 1200 by 630 PNG`, () => {
    const png = readFileSync(fileFor(page.image));
    assert.ok(png.length > 33, 'PNG cannot be empty or only a header');
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
  });

  test(`retro ${page.locale}: signup and paid-plan links work with JavaScript disabled and retain campaign attribution`, () => {
    const anchors = tags(readPage(page), 'a');
    for (const [action, pathname] of [['signup', '/register'], ['plans', '/subscribe']]) {
      const calls = anchors.filter(anchor => anchor['data-retro-action'] === action);
      assert.ok(calls.length > 0, `${action} CTA is missing`);
      for (const call of calls) {
        const url = new URL(call.href);
        assert.equal(url.origin, 'https://edgefocus.ru');
        assert.equal(url.pathname, pathname);
        assert.equal(url.username + url.password, '');
        assert.equal(url.searchParams.get('utm_source'), 'retro');
        assert.equal(url.searchParams.get('utm_medium'), 'website');
        assert.equal(url.searchParams.get('utm_campaign'), campaign);
        assert.ok(['hero', 'header', 'footer', 'plans', 'page', 'demo'].includes(url.searchParams.get('utm_content')));
        assert.equal(url.searchParams.get('utm_content'), call['data-retro-placement']);
      }
    }
    assert.ok(anchors.some(anchor => anchor.href === 'https://edgefocus.ru/trust'));
    assert.ok(anchors.some(anchor => anchor.href === 'https://ivaikin.com/'));
  });

  test(`retro ${page.locale}: links, scripts, images, CSS and CSS assets resolve from the actual locale path`, () => {
    const html = readPage(page);
    const pageUrl = origin + page.pathname;
    const resourceTags = ['a', 'link', 'script', 'img', 'source', 'audio', 'video']
      .flatMap(name => tags(html, name));
    for (const tag of resourceTags) {
      for (const value of [tag.href, tag.src, tag.poster]) assertLocalTarget(value, pageUrl);
    }
    for (const link of tags(html, 'link').filter(link => link.rel === 'stylesheet')) {
      const url = new URL(link.href, pageUrl);
      assert.equal(url.origin, origin, 'stylesheets must be self-hosted');
      const css = readFileSync(fileFor(url.pathname), 'utf8');
      for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) assertLocalTarget(match[1], url.href);
    }
  });

  test(`retro ${page.locale}: no analytics SDK, session replay or external script is loaded`, () => {
    const html = readPage(page);
    const scripts = tags(html, 'script').filter(script => script.src);
    assert.ok(scripts.length > 0, 'interactive scripts are present');
    const scriptBodies = [];
    for (const script of scripts) {
      const url = new URL(script.src, origin + page.pathname);
      assert.equal(url.origin, origin, `external script: ${url.href}`);
      assert.ok(url.pathname.startsWith('/retro/'), 'only retro scripts may run on the demo');
      assert.doesNotMatch(url.pathname, /(?:analytics|funnel|error-collector)\.js$/);
      scriptBodies.push(readFileSync(fileFor(url.pathname), 'utf8'));
    }
    const shipped = html + '\n' + scriptBodies.join('\n');
    assert.doesNotMatch(shipped, /(?:mc\.yandex\.ru\/metrika\/tag\.js|posthog(?:-js)?[\/]dist|\/static\/array\.js|googletagmanager\.com\/gtag)/i);
    assert.doesNotMatch(shipped, /\bposthog\s*\.\s*init\s*\(|\bwebvisor\s*:\s*true|\bstartSessionRecording\s*\(|\bcreateElement\s*\(\s*['"]script['"]/i);
    assert.ok(tags(html, 'button').some(button => button.id === 'analytics-toggle' && button['aria-pressed'] === 'false'),
      'optional analytics starts off');
  });
}

test('retro discovery is additive on the existing homepage and sitemap', () => {
  const homepage = readFileSync(fileFor('/index.html'), 'utf8');
  const footer = homepage.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0];
  assert.ok(footer, 'homepage footer remains present');
  const hero = homepage.match(/<section\b[^>]*class="hero"[^>]*>[\s\S]*?<\/section>/i)?.[0];
  assert.ok(hero, 'homepage hero remains present');
  assert.ok(tags(hero, 'a').some(link => new URL(link.href, origin).pathname === '/retro/' && link['data-i18n'] === 'heroRetro'),
    'retro edition is discoverable in the hero on narrow and wide layouts');
  const discovery = tags(hero, 'a').find(link => link['data-i18n'] === 'heroRetro');
  const campaign = new URL(discovery.href, origin).searchParams;
  assert.equal(campaign.get('utm_source'), 'edgefocus');
  assert.equal(campaign.get('utm_campaign'), 'edgefocus-retro-202610');
  assert.ok(tags(footer, 'a').some(link => new URL(link.href, origin).pathname === '/retro/'));
  assert.equal(tags(homepage, 'link').find(link => link.rel === 'canonical')?.href, origin + '/');
  const sitemap = readFileSync(fileFor('/sitemap.xml'), 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  for (const path of ['/', '/ru/eva/', '/en/eva/', '/ru/developers/', '/en/developers/', '/ru/partners/', '/en/partners/', '/retro/', '/retro/ru/']) {
    assert.equal(locations.filter(value => value === origin + path).length, 1, `sitemap must contain exactly one ${path}`);
  }
});

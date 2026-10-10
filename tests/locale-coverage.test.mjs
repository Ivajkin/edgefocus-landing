import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const locales = ['en', 'ru', 'ar', 'zh'];
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const translationFile = new URL('../translations.js', import.meta.url);

function loadCopy() {
    assert.ok(existsSync(translationFile), 'the landing page needs its translation dictionary');
    const context = {window: {}};
    vm.runInNewContext(readFileSync(translationFile, 'utf8'), context, {filename: 'translations.js'});
    assert.ok(context.window.EDGEFOCUS_COPY, 'the classic script exposes EDGEFOCUS_COPY');
    return context.window.EDGEFOCUS_COPY;
}

test('every visible, accessible and metadata translation key is complete in all four locales', () => {
    const copy = loadCopy();
    const keys = [...html.matchAll(/\bdata-i18n(?:-aria|-content)?\s*=\s*["']([^"']+)["']/g)]
        .map((match) => match[1]);
    assert.ok(keys.length > 0, 'the landing page exposes translatable content');

    for (const key of new Set(keys)) {
        for (const locale of locales) {
            assert.equal(typeof copy[locale]?.[key], 'string', `${locale}.${key} is missing`);
            assert.ok(copy[locale][key].trim(), `${locale}.${key} is empty`);
        }
    }
});

test('dynamic copy has the same complete key set in every locale', () => {
    const copy = loadCopy();
    assert.deepEqual(Object.keys(copy).sort(), [...locales].sort());
    const keys = Object.keys(copy.en).sort();
    assert.ok(keys.length > 0, 'the dictionary must not be empty');

    for (const locale of locales) {
        assert.deepEqual(Object.keys(copy[locale]).sort(), keys, `${locale} key coverage differs`);
        for (const key of keys) {
            assert.equal(typeof copy[locale][key], 'string', `${locale}.${key} is not text`);
            assert.ok(copy[locale][key].trim(), `${locale}.${key} is empty`);
        }
    }
});

test('Arabic and simplified Chinese content are preserved alongside English and Russian', () => {
    const copy = loadCopy();
    assert.match(copy.ar.heroTitle, /\p{Script=Arabic}/u, 'Arabic copy supports the RTL locale');
    assert.match(copy.zh.heroTitle, /\p{Script=Han}/u, 'Chinese copy supports the Chinese locale');
    assert.match(copy.ru.heroTitle, /\p{Script=Cyrillic}/u);
    assert.match(copy.en.heroTitle, /[A-Za-z]/);
});

test('displayed prices use RUB for Russian and USD for the other locales', () => {
    const copy = loadCopy();
    for (const locale of locales) {
        for (const key of ['freePrice', 'proPrice']) {
            assert.match(copy[locale][key], locale === 'ru' ? /₽/ : /\$/);
            assert.doesNotMatch(copy[locale][key], locale === 'ru' ? /\$/ : /₽/);
        }
    }
});

test('copy does not restore unsupported performance, growth or security guarantees', () => {
    const copy = loadCopy();
    const unsupportedClaims = /99[.,]9\s*%|sub[-\s]?100\s*ms|end[-\s]to[-\s]end\s+encrypt|\b3\s*[×x]\s*(?:faster|ROI)|revenue\s+acceleration|сквозн\S*\s+шифрован|гарантирован\S*\s+(?:рост|безопасност|результат)|تشفير\s+من\s+طرف\s+إلى\s+طرف|نمو\s+مضمون|端到端加密|保证增长/iu;

    for (const locale of locales) {
        for (const [key, value] of Object.entries(copy[locale])) {
            assert.doesNotMatch(value, unsupportedClaims, `${locale}.${key} contains an unsupported claim`);
        }
        assert.ok(copy[locale].demoDisclaimer, `${locale} needs an illustrative-example disclaimer`);
    }
});

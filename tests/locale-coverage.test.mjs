import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const translatedTags = html.match(/<[^>]*\bdata-en="[^"]*"[^>]*>/gs) ?? [];

function localeValue(tag, locale) {
    return tag.match(new RegExp(`\\bdata-${locale}="([^"]*)"`, 's'))?.[1];
}

test('every marked landing-page element has all four locale values', () => {
    assert.equal(translatedTags.length, 128, 'the known landing-page translation surface changed');

    for (const locale of ['en', 'ru', 'ar', 'zh']) {
        const missing = translatedTags
            .map((tag, index) => ({index: index + 1, value: localeValue(tag, locale)}))
            .filter(({value}) => value === undefined || value.trim() === '');

        assert.deepEqual(missing, [], `${locale} has missing translations`);
    }
});

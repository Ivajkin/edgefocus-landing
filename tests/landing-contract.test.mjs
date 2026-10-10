import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('new visitors can register directly from every primary conversion point',()=>{
 const links=html.match(/<a\b[^>]*data-cta="signup"[^>]*>/g)||[];
 assert.ok(links.length>=4,'registration must be available in nav, hero, pricing and final CTA');
 for(const link of links)assert.match(link,/href="https:\/\/edgefocus.ru\/register"/);
});
test('the example is explicitly illustrative and does not require an account',()=>{
 assert.match(html,/<button[^>]*id="demo-toggle"[^>]*aria-pressed="false"/);
 assert.match(html,/data-i18n="demoDisclaimer"/);
 assert.match(html,/<main\b/);
});
test('all local shipped asset links resolve',()=>{
 const refs=[...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(x=>x[1]).filter(x=>!x.includes(':')&&!x.startsWith('#'));
 for(const ref of refs)assert.ok(existsSync(new URL('../'+ref,import.meta.url)),ref);
});

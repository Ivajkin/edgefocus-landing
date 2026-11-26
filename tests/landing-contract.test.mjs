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
test('the shared preview matches the live EdgeFocus positioning',()=>{
 const meta=name=>html.match(new RegExp(`<meta\\b[^>]*(?:name|property)="${name}"[^>]*>`))?.[0]||'';
 const content=name=>{
  const tag=meta(name);
  const value=tag.match(/(?:^|\s)content="([^"]*)"/);
  assert.ok(value,name);
  return value[1];
 };
 const title='EdgeFocus: AI Agent Execution Platform for Teams';
 const description='Connect AI agents to your tasks, CRM and workflows via MCP. EVA, automation and bottleneck analysis turn intent into measurable outcomes.';
 assert.match(html,new RegExp(`<title[^>]*>${title}</title>`));
 assert.equal(content('description'),description);
 assert.equal(content('og:title'),title);
 assert.equal(content('og:description'),description);
 assert.equal(content('twitter:title'),title);
 assert.equal(content('twitter:description'),description);
 assert.equal(content('og:image'),'https://landing.edgefocus.ru/assets/social.png');
 assert.equal(content('twitter:image'),'https://landing.edgefocus.ru/assets/social.png');
 assert.equal(content('og:image:width'),'1200');
 assert.equal(content('og:image:height'),'630');
 assert.equal(content('og:image:type'),'image/png');
 assert.match(content('og:image:alt'),/Aurora Wing/);
 assert.match(content('twitter:card'),/summary_large_image/);
 assert.match(html,/data-i18n="heroTitle"[^>]*>From intent to measurable outcomes</);
 const png=readFileSync(new URL('../assets/social.png',import.meta.url));
 assert.equal(png.readUInt32BE(16),1200);
 assert.equal(png.readUInt32BE(20),630);
 assert.ok(png.length<300*1024,'the link image stays under 300 KB');
 assert.ok(existsSync(new URL('../favicon.ico',import.meta.url)));
 assert.ok(existsSync(new URL('../assets/favicon.svg',import.meta.url)));
});

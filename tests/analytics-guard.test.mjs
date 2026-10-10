import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
test('preview and explicit QA visits do not initialize any analytics provider',()=>{
 for(const [hostname,search] of [['localhost',''],['staging.edgefocus.ru',''],['landing.edgefocus.ru','?qa=1'],['landing.edgefocus.ru','?audit=mobile'],['landing.edgefocus.ru','?verify=revision'],['landing.edgefocus.ru','?deploy=revision']]){
  const context={window:{},location:{hostname,search},URLSearchParams};
  context.document=new Proxy({}, {get(){throw new Error('analytics touched document')}});
  assert.doesNotThrow(()=>vm.runInNewContext(source,context),hostname+search);
 }
});

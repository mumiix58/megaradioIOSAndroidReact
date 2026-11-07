const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/tvanddesktop/apple-tv-and-macos/web-preview/node_modules/typescript');
const vm = require('node:vm');
const source = fs.readFileSync('frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/lib/platformBack.ts', 'utf8');
const ctx = { exports: {} }; vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, ctx);
const back = ctx.exports.handleEntryBack;
test('LG SDK delegates Home/exit and old webOS Palm bridge remains supported', () => {
 let sdk=0, old=0, modal=0;
 back('webos',{webOS:{platformBack(){sdk++}}},()=>modal++);
 back('webos',{PalmSystem:{platformBack(){old++}}},()=>modal++);
 assert.equal(sdk,1);assert.equal(old,1);assert.equal(modal,0);
});
test('Tizen keeps custom confirmation; absent/throwing LG bridge retains usable exit',()=>{
 let calls=0,modal=0; const confirm=()=>modal++;
 back('tizen',{webOS:{platformBack(){calls++}}},confirm);
 back('webos',{},confirm);
 back('webos',{PalmSystem:{platformBack(){throw Error('unavailable')}}},confirm);
 assert.equal(calls,0);assert.equal(modal,3);
});

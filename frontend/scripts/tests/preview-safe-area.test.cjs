const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/utils/previewSafeArea.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function read({dev=true,os='web',enabled='1',embedded=true,name='',search='',storage={}}={}){const mod={exports:{}},window={name,location:{search},sessionStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v}}};window.parent=embedded?{}:window;vm.runInNewContext(code,{module:mod,exports:mod.exports,require:()=>({Platform:{OS:os}}),__DEV__:dev,URLSearchParams,process:{env:{EXPO_PUBLIC_WEB_PREVIEW_PROXY:enabled}},window});return JSON.parse(JSON.stringify(mod.exports.previewSafeArea()));}
const none={top:0,bottom:0,width:0,height:0},legacy={top:59,bottom:34,width:430,height:932};
for(const os of ['ios','android'])assert.deepEqual(read({os}),none,'native safe areas remain OS-owned');
assert.deepEqual(read({dev:false}),none);assert.deepEqual(read({embedded:false}),none);assert.deepEqual(read({enabled:'0'}),none);
for(const top of [24,59]){const metrics={top,bottom:24,width:360,height:740};assert.deepEqual(read({name:'mega-preview:'+JSON.stringify(metrics)}),metrics);}
assert.deepEqual(read({name:'mega-preview:{bad'}),legacy);assert.deepEqual(read({name:'mega-preview:'+JSON.stringify({...legacy,top:-10})}),legacy);
console.log('PASS preview metrics, 24/59px hosts, native/production isolation and malformed input fallback');

const storage={},android={top:24,bottom:24,width:360,height:740};
assert.deepEqual(read({search:'?__megaPreview='+encodeURIComponent(JSON.stringify(android)),storage}),android);
assert.deepEqual(read({storage}),android,'device survives SPA route and window.name reset');
assert.deepEqual(read({storage,os:'android'}),none,'preview cache never changes native insets');
console.log('PASS URL bootstrap and tab-scoped metric persistence across route changes');

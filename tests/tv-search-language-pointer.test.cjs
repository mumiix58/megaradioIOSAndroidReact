const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const {JSDOM}=require(require.resolve('jsdom',{paths:[base]}));
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test/#/search'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;
const React=require(path.join(base,'node_modules/react')), {createRoot}=require(path.join(base,'node_modules/react-dom/client')), {flushSync}=require(path.join(base,'node_modules/react-dom')),ts=require(path.join(base,'node_modules/typescript'));
let handler;
const modules={
 'react':React,'wouter':{useLocation:()=>['/search',()=>{}]},
 '@tanstack/react-query':{useQuery:()=>({data:undefined,isFetching:false})},
 '@/lib/imageUtils':{resolveStationImageUrl:x=>x,handleStationImageError(){}},
 '@/services/megaRadioApi':{megaRadioApi:{}},
 '@/contexts/FocusRouterContext':{usePageKeyHandler:(_route,callback)=>{handler=callback}},
 '@/contexts/GlobalPlayerContext':{useGlobalPlayer:()=>({playStation(){}})},
 '@/services/recentlyPlayedService':{recentlyPlayedService:{getStations:()=>[]}},
 '@/contexts/LocalizationContext':{useLocalization:()=>({t:x=>x})},
 '@/components/Sidebar':{Sidebar:()=>null},'@/lib/assetPath':{assetPath:x=>x},
 '@/contexts/HelpContext':{useHelp:()=>({openHelp(){},closeHelp(){},helpOpen:false})},
 '@/hooks/useNativeKeyboard':{useNativeKeyboard(){}},
 '@/contexts/NavigationContext':{useNavigation:()=>({setNavigationState(){},popNavigationState(){},navigationState:null}),usePageSnapshot(){},useSavedNavigationData:()=>null},
 '@/lib/navigationRestore':{restoreNavigationPosition(){}}
};
const exportsActual={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base,'src/pages/Search.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports:exportsActual,React,require:name=>{assert.ok(name in modules,'Unexpected unstubbed dependency '+name);return modules[name]},window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,URLSearchParams:dom.window.URLSearchParams,setTimeout,clearTimeout});
const query=id=>document.querySelector('[data-testid="'+id+'"]');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function click(node){assert.ok(node,'Expected actual rendered control');flushSync(()=>node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));await tick()}
async function key(code){flushSync(()=>handler({keyCode:code,preventDefault(){}}));await tick()}
test('actual Search pointer opens keyboard languages, selects keys and retains remote dropdown navigation',async()=>{
 const root=createRoot(document.getElementById('root'));
 try {
  flushSync(()=>root.render(React.createElement(exportsActual.Search)));await tick();
  assert.match(query('lang-selector-button').textContent,/English/);assert.equal(query('layout-tr'),null);
  await click(query('lang-selector-button'));
  assert.ok(query('layout-tr'),'pointer must open the actual language dropdown');
  assert.match(query('layout-en').className,/bg-\[#ff4199\]/,'opening initializes logical focus to active English');
  await click(query('layout-tr'));
  assert.equal(query('layout-tr'),null);assert.match(query('lang-selector-button').textContent,/Türkçe/);assert.ok(query('key-Ç'));
  await click(query('lang-selector-button'));assert.match(query('layout-tr').className,/bg-\[#ff4199\]/,'reopening focuses the selected layout');
  await key(40);assert.match(query('layout-ar').className,/bg-\[#ff4199\]/);await key(13);
  assert.equal(query('layout-ar'),null);assert.ok(query('key-ا'));assert.match(query('lang-selector-button').textContent,/العربية/);
  await key(38);await key(40);await key(13);assert.ok(query('layout-ar'),'D-pad can still reopen from the language button');
  await key(37);assert.equal(query('layout-ar'),null,'Left closes the dropdown');assert.ok(query('key-ا'));
 } finally {flushSync(()=>root.unmount());dom.window.close()}
});

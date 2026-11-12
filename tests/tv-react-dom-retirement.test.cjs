const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const {JSDOM}=require(require.resolve('jsdom',{paths:[base]}));
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;
const React=require(path.join(base,'node_modules/react'));
const {createRoot}=require(path.join(base,'node_modules/react-dom/client'));
const {flushSync}=require(path.join(base,'node_modules/react-dom'));
const ts=require(path.join(base,'node_modules/typescript'));
const current=fs.readFileSync(path.join(base,'src/components/HorizontalScrollCues.tsx'),'utf8');
async function trial(passiveControl){
 const source=passiveControl?current.replace(/\buseLayoutEffect\b/g,'useEffect'):current;
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,React,require:n=>n==='react'?React:{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},window:dom.window});
 const ref=React.createRef();let mountedReads=0,detachedReads=0,afterRemoval=false;
 function Route(){return React.createElement('section',null,React.createElement('div',{ref}),React.createElement(exports.HorizontalScrollCues,{id:'actual-cues',scrollRef:ref,count:3}))}
 const root=createRoot(document.getElementById('root'));const originalRemove=dom.window.Node.prototype.removeChild;
 try{
  flushSync(()=>root.render(React.createElement(Route)));await new Promise(r=>setImmediate(r));
  const scroller=ref.current;
  for(const [key,value]of [['scrollWidth',900],['clientWidth',300]])Object.defineProperty(scroller,key,{get(){if(afterRemoval)detachedReads++;else mountedReads++;return value}});
  scroller.dispatchEvent(new dom.window.Event('scroll'));assert.equal(mountedReads,2,'both variants install a working actual component listener');
  dom.window.Node.prototype.removeChild=function(child){const removed=originalRemove.call(this,child);if(child.contains(scroller)){assert.equal(scroller.isConnected,false);afterRemoval=true;scroller.dispatchEvent(new dom.window.Event('scroll'));afterRemoval=false}return removed};
  flushSync(()=>root.render(null));await new Promise(r=>setImmediate(r));return {mountedReads,detachedReads};
 }finally{dom.window.Node.prototype.removeChild=originalRemove;root.unmount()}
}
test('actual ReactDOM teardown retires the cue listener before its host DOM leaves the document',async()=>{
 const baseline=await trial(true);assert.equal(baseline.detachedReads,2,'passive cleanup baseline reaches already removed geometry');
 const fixed=await trial(false);assert.equal(fixed.detachedReads,0,'layout cleanup blocks the same retiring-DOM callback');
});

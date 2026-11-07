const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const ts=require(path.join(base,'node_modules/typescript'));
function legacyElement(){
 const listeners=[];let reads=0;
 const el={firstElementChild:null,addEventListener(type,fn,capture){listeners.push({type,fn,capture:!!capture})},removeEventListener(type,fn,capture){const i=listeners.findIndex(x=>x.type===type&&x.fn===fn&&x.capture===!!capture);if(i>=0)listeners.splice(i,1)}};
 for(const [key,value]of Object.entries({scrollLeft:0,scrollWidth:900,clientWidth:300,scrollTop:100,scrollHeight:1200,clientHeight:400}))Object.defineProperty(el,key,{get(){reads++;return value}});
 return {el,listeners,reads:()=>reads};
}
test('actual horizontal cue component removes old-engine listener and ignores queued retired callbacks',()=>{
 const state=legacyElement();let cleanup,updates=0,frame,observerCallback;
 const react={useState:()=>[{left:false,right:false},()=>updates++],useEffect:f=>{cleanup=f()},createElement:()=>null};
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base,'src/components/HorizontalScrollCues.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,{exports,require:n=>n==='react'?react:{},React:react,requestAnimationFrame:f=>{frame=f;return 1},cancelAnimationFrame:()=>{},ResizeObserver:class{constructor(f){observerCallback=f}observe(){}disconnect(){}},window:{addEventListener(){},removeEventListener(){}}});
 exports.HorizontalScrollCues({id:'proof',scrollRef:{current:state.el},count:3});
 assert.equal(state.listeners.length,1);assert.equal(state.listeners[0].capture,false);
 const queued=state.listeners[0].fn;queued();assert.equal(updates,1);assert.ok(state.reads()>0);
 cleanup();assert.equal(state.listeners.length,0);const reads=state.reads();queued();frame();observerCallback();assert.equal(state.reads(),reads);assert.equal(updates,1);
});
test('actual Discover scroll effect retires geometry and loading work when leaving the route',()=>{
 const source=fs.readFileSync(path.join(base,'src/pages/DiscoverNoUser.tsx'),'utf8');
 const effect=source.match(/useEffect\(\(\) => \{\n    const scrollContainer = scrollContainerRef.current;[\s\S]*?\n  \}, \[\]\);/);
 assert.ok(effect,'actual Discover scroll effect');const state=legacyElement();let cleanup,loads=0,headerChanges=0;
 vm.runInNewContext(effect[0],{useEffect:f=>{cleanup=f()},scrollContainerRef:{current:state.el},lastScrollTime:{current:0},lastScrollY:{current:0},isLoadingRef:{current:false},loadMoreRef:{current:()=>loads++},setShowHeader:()=>headerChanges++,Date:{now:()=>1000}});
 assert.equal(state.listeners.length,1);assert.equal(state.listeners[0].capture,false);const queued=state.listeners[0].fn;queued();assert.equal(loads,1);assert.equal(headerChanges,1);
 cleanup();assert.equal(state.listeners.length,0);const reads=state.reads();queued();assert.equal(state.reads(),reads);assert.equal(loads,1);assert.equal(headerChanges,1);
});
test('actual GenreList effect cancels both the listener and already queued load timer',()=>{
 const source=fs.readFileSync(path.join(base,'src/pages/GenreList.tsx'),'utf8');
 const effect=source.match(/useEffect\(\(\) => \{\n    const scrollContainer = scrollContainerRef.current;[\s\S]*?\n  \}, \[hasMore, isLoadingMore, currentOffset\]\);/);
 assert.ok(effect);const state=legacyElement();let cleanup,queuedTimer,loads=0;
 vm.runInNewContext(effect[0],{useEffect:f=>{cleanup=f()},scrollContainerRef:{current:state.el},loadMoreTimer:{current:undefined},hasMore:true,isLoadingMore:false,currentOffset:0,loadMore:()=>loads++,clearTimeout:()=>{},setTimeout:f=>{queuedTimer=f;return 1}});
 assert.equal(state.listeners[0].capture,false);const queued=state.listeners[0].fn;queued();assert.ok(queuedTimer);cleanup();assert.equal(state.listeners.length,0);const reads=state.reads();queuedTimer();queued();assert.equal(state.reads(),reads);assert.equal(loads,0);
});
test('actual drag hook remains cancelable, removes window capture consistently and retires late movement',()=>{
 const local=legacyElement(),global=legacyElement();let cleanup,value=30,writes=0,prevented=0;
 const el={...local.el,classList:{add(){},remove(){}}};Object.defineProperty(el,'scrollLeft',{get:()=>value,set:v=>{value=v;writes++}});
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base,'src/hooks/useDragScroll.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({useEffect:f=>{cleanup=f()}}),window:global.el});
 exports.useDragScroll({current:el});const down=local.listeners.find(x=>x.type==='pointerdown').fn;down({pointerType:'mouse',button:0,clientX:100});
 const move=global.listeners.find(x=>x.type==='pointermove');assert.equal(move.capture,false);move.fn({clientX:80,preventDefault(){prevented++}});assert.equal(value,50);assert.equal(prevented,1);
 const end=global.listeners.find(x=>x.type==='pointerup').fn;end();assert.equal(global.listeners.length,0);assert.equal(local.listeners.filter(x=>x.type==='click').length,1);
 down({pointerType:'mouse',button:0,clientX:100});const late=global.listeners.find(x=>x.type==='pointermove').fn;cleanup();assert.equal(global.listeners.length,0);assert.equal(local.listeners.length,0);const oldWrites=writes;late({clientX:60,preventDefault(){prevented++}});down({pointerType:'mouse',button:0,clientX:10});assert.equal(writes,oldWrites);assert.equal(global.listeners.length,0);
});

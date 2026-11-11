const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/hooks/useDirectoryFollowing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
 const slots=[],effects=[],reads=[],writes=[],storage=new Map();let cursor=0,active=0,max=0,clock=1000;
 const state={owner:'a',ids:['one','two'],enabled:true,fail:new Set(),writeDeferred:null};
 const React={useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},useRef(initial){const i=cursor++;return slots[i]||(slots[i]={current:initial});},useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>d!==old.deps[n])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}};
 const api={async get(url,config){reads.push({url,config});active++;max=Math.max(max,active);await Promise.resolve();active--;if(config.signal.aborted)throw Error('aborted');const id=url.split('/').pop();if(state.fail.has(id))throw Error('unavailable');return{data:{isFollowing:id==='one'}};},async post(url){writes.push(url);if(state.writeDeferred)await state.writeDeferred;return{data:{success:true}};},async delete(url){writes.push(url);if(state.writeDeferred)await state.writeDeferred;return{data:{success:true}};}};
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,AbortController,Date:{now:()=>clock},require:id=>id==='react'?React:id.includes('async-storage')?{getItem:async key=>storage.get(key)||null,setItem:async(key,value)=>storage.set(key,value)}:id.includes('authStore')?{useAuthStore:()=>({isAuthenticated:true,user:{_id:state.owner},token:'test-token'})}:api});
 const render=()=>{cursor=0;const view=module.exports.useDirectoryFollowing(state.ids,state.enabled);effects.splice(0).forEach(fn=>fn());return view;};
 return{state,render,reads,writes,storage,get max(){return max;},advance:()=>clock+=61000};
}
(async()=>{
 const h=harness();h.storage.set('megaradio_follow_status:user:a',JSON.stringify({one:false}));h.render();await tick();let view=h.render();assert.equal(view.values.one,true);assert.equal(view.values.two,false);assert.equal(h.reads.length,2);
 h.state.ids=['three','four'];h.render();await tick();view=h.render();assert.equal(h.reads.length,4);assert.equal(view.values.one,true,'scroll keeps previous statuses');
 h.state.ids=['one','two'];h.render();await tick();assert.equal(h.reads.length,4,'fresh visible statuses are reused');
 const cache=JSON.parse(h.storage.get('megaradio_follow_status:user:a'));assert.equal(cache.values.one,true);assert.equal(cache.values.four,false,'pages merge in disk cache');
 h.state.ids=Array.from({length:10},(_,i)=>'visible-'+i);h.render();await tick();assert.equal(h.reads.length,14);assert.ok(h.max<=4,'bounded concurrency');
 h.state.fail.add('unavailable');h.state.ids=['unavailable'];h.render();await tick();view=h.render();assert.equal(view.values.unavailable,undefined);assert.equal(view.errors.unavailable,true,'read failure does not manufacture an unfollow');
 const before=h.writes.length;await view.toggle('unavailable');h.render();await tick();assert.equal(h.writes.length,before,'retry is read-only');
 h.state.ids=['one'];h.render();await tick();view=h.render();let release;h.state.writeDeferred=new Promise(r=>release=r);const a=view.toggle('one'),b=view.toggle('one');assert.equal(h.writes.length,1,'double tap writes once');release();await Promise.all([a,b]);h.state.writeDeferred=null;view=h.render();assert.equal(view.values.one,false);
 h.state.owner='b';view=h.render();assert.equal(Object.keys(view.values).length,0,'account change hides previous account immediately');await tick();view=h.render();assert.equal(view.values.one,true);
 h.state.ids=['later'];h.render();const recent=h.reads.length;h.state.enabled=false;h.render();await tick();assert.equal(h.reads.length,recent,'blur cancels pending checks before network');
 console.log('PASS visible-only reads, 4-worker cap, fresh reuse, scroll persistence, merged disk cache, failure truthfulness, double-tap guard, owner isolation and blur cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../../src/services/firebaseRuntimeService.native.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(offline=false){
 const calls=[];let lifecycle;
 const config={setDefaults:async x=>calls.push(['defaults',x]),setConfigSettings:async()=>{},activate:async()=>{},getBoolean:()=>false,getNumber:k=>({radio_ad_min_interval_seconds:600,radio_ad_station_changes:5,radio_ad_session_cap:3})[k],fetchAndActivate:async()=>{calls.push(['fetch']);if(offline)throw Error('offline');}};
 const exports={};
 vm.runInNewContext(source,{exports,__DEV__:false,require(name){
  if(name==='react-native')return{AppState:{addEventListener:(_,cb)=>{lifecycle=cb;return{remove(){}}}}};
  if(name==='../utils/adPolicy')return{updateAutomaticAdPolicy:x=>calls.push(['policy',x])};
  if(name==='@react-native-firebase/remote-config')return{default:()=>config};
  if(name==='@react-native-firebase/perf')return{default:()=>({setPerformanceCollectionEnabled:async x=>calls.push(['perf',x]),startTrace:async name=>({putAttribute:(k,v)=>calls.push(['attribute',k,v]),stop:async()=>{},name})})};
  throw Error(name);
 }});
 return{api:exports,calls,foreground:()=>lifecycle('active')};
}
test('remote config startup is coalesced, applies defaults/kill switch and survives offline fetch',async()=>{
 const f=fixture(true);await Promise.all([f.api.initializeFirebaseRuntime(),f.api.initializeFirebaseRuntime()]);
 assert.equal(f.calls.filter(x=>x[0]==='defaults').length,1);
 assert.equal(f.calls.find(x=>x[0]==='policy')[1].enabled,false);
 assert.deepEqual(f.calls.find(x=>x[0]==='perf'),['perf',true]);
 f.foreground();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.calls.filter(x=>x[0]==='fetch').length,2);
});
test('custom performance traces have a constant name and bounded method only',async()=>{
 const f=fixture();const trace=await f.api.startApiPerformanceTrace('POST /account?token=secret');
 assert.equal(trace.name,'radio_api_request');
 assert.deepEqual(f.calls,[['attribute','method','OTHER']]);
});

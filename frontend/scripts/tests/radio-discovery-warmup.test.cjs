const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {QueryClient}=require('@tanstack/react-query');
let requests=0,finish;
const heard=new Set(['heard']);
const mocks={'./discoveryRadioVerifier':{blockedDiscoveryRadio:()=>false},'./groupDiscoveryHistory':{groupDiscoveryHistory:()=>({ready:Promise.resolve(),history:{has:s=>heard.has(s._id)}})},'./groupRadioDiscovery':{loadGroupRadioDeck:async(genres,signal,excluded)=>{requests++;assert.equal(excluded({_id:'heard'}),true);assert.equal(excluded({_id:'fresh'}),false);return new Promise(resolve=>{finish=()=>resolve([{_id:'fresh',genres}]);});}}};
const result={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/radioDiscoveryQuery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:result,exports:result.exports,require:id=>mocks[id]});
const {radioDiscoveryQuery}=result.exports;
(async()=>{const client=new QueryClient({defaultOptions:{queries:{gcTime:0}}});try{
 const warming=client.prefetchQuery(radioDiscoveryQuery('owner',['rock','electronic']));await new Promise(setImmediate);
 const opening=client.fetchQuery(radioDiscoveryQuery('owner',['electronic','rock']));assert.equal(requests,1,'confirmation shares selection warmup instead of starting another request');finish();await warming;const deck=await opening;assert.equal(deck[0]._id,'fresh');
 await client.fetchQuery(radioDiscoveryQuery('owner',['rock','electronic']));assert.equal(requests,1,'fresh warmup cache is reused on entry');
 assert.notDeepEqual(radioDiscoveryQuery('other',['rock']).queryKey,radioDiscoveryQuery('owner',['rock']).queryKey,'account history is isolated');
 assert.notDeepEqual(radioDiscoveryQuery('owner',['rock'],1).queryKey,radioDiscoveryQuery('owner',['rock']).queryKey,'exhaustion still loads a new deck');
 console.log('PASS shared warmup request, canonical selection key, fresh cache, history exclusion, account isolation and refill');
 }finally{client.clear();}})().catch(e=>{console.error(e);process.exitCode=1;});

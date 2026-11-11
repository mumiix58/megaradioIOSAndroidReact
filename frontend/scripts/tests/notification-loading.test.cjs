const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {QueryClient}=require('@tanstack/react-query');
let calls=0,requests=[];
const api={get:(_path,{signal})=>{calls++;return new Promise((resolve,reject)=>{requests.push({signal,resolve:data=>resolve({data})});signal.addEventListener('abort',()=>reject(new Error('cancelled')));});}};
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/notificationQueries.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:name=>name==='./api'?api:{API_ENDPOINTS:{user:{notifications:'/notifications'}}}});
const options=mod.exports.notificationQueryOptions;
(async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 try{
  const a=options('account-a');
  const bell=client.prefetchQuery(a),screen=client.fetchQuery(a),focus=client.prefetchQuery(a);
  assert.equal(calls,1,'bell, mount and focus share one in-flight read');
  requests[0].resolve({notifications:[{_id:'a-1'}]});await Promise.all([bell,screen,focus]);
  await client.fetchQuery(a);assert.equal(calls,1,'fresh revisit renders cached data without another read');
  await client.invalidateQueries({queryKey:['notifications','account-a'],refetchType:'none'});
  const refreshed=client.fetchQuery(a);assert.equal(calls,2,'push/invalidation still refreshes immediately');requests[1].resolve({notifications:[{_id:'a-2'}]});await refreshed;
  const b=client.fetchQuery(options('account-b'));assert.equal(calls,3);requests[2].resolve({notifications:[{_id:'b-1'}]});await b;
  assert.equal(client.getQueryData(a.queryKey).notifications[0]._id,'a-2','no account cache mixing');
  const c=client.prefetchQuery(options('cancelled'));const request=requests[3];await client.cancelQueries({queryKey:['notifications','cancelled']});assert.equal(request.signal.aborted,true);await c;
  assert.equal(a.retry(0,{response:{status:401}}),false,'do not retry expired sessions');
  console.log('PASS one request for bell/mount/focus, warm-cache revisit, immediate invalidation refresh, account isolation and cancellation');
 }finally{client.clear();}
})().catch(error=>{console.error(error);process.exitCode=1;});

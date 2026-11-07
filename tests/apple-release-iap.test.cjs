const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
function fixture(response = {success:true,isActive:true,plan:'premium_monthly'}) {
  const state = {handlers:{},events:[],finished:[],requests:[],bodies:[],purchases:[],response};
  const store = {
    on: (_name, fn) => state.listener=fn,
    canMakePayments:()=>true, getReceiptURL:()=>'/fixture/receipt',
    purchaseProduct:async (id,opts)=>{state.purchases.push({id,opts});return true;},
    restoreCompletedTransactions:()=>{}, finishTransactionByDate:x=>state.finished.push(x),
  };
  const https = {request(options,cb) {
    state.requests.push(options);
    const request=new EventEmitter(); request.write=data=>state.bodies.push(data);request.destroy=()=>{};
    request.end=()=>queueMicrotask(()=>{
      const result=new EventEmitter();result.statusCode=options.path.includes('/verify')?200:(state.status || 200);
      cb(result);result.emit('data',JSON.stringify(options.path.includes('/verify')?{valid:true}:state.response));result.emit('end');
    });return request;
  }};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../frontend/tvanddesktop/desktop/electron/iap.js'),'utf8'), {
    module,process:{platform:'darwin',mas:true},Buffer,console:{log(){},warn(){}},
    setTimeout:()=>1,clearTimeout(){},
    require(name){if(name==='electron')return {inAppPurchase:store};if(name==='https')return https;if(name==='fs')return {existsSync:()=>true,readFileSync:()=>Buffer.from('app-receipt')};return require(name);}
  });
  module.exports.registerIpc({handle:(name,fn)=>state.handlers[name]=fn},()=>({isDestroyed:()=>false,webContents:{send:(...args)=>state.events.push(args)}}));
  state.auth=t=>state.handlers['mr-iap-set-auth'](null,t);
  state.buy=()=>state.handlers['mr-iap-purchase'](null,{productId:'megaradio_premium_monthly1',token:'account-a'});
  state.restore=()=>state.handlers['mr-iap-restore'](null,{token:'account-a'});
  state.tx=(override={})=>({transactionIdentifier:'txn-1',transactionDate:'date-1',transactionState:'purchased',payment:{productIdentifier:'megaradio_premium_monthly1',applicationUsername:state.purchases[0]?.opts.username},...override});
  return state;
}
test('Mac App Store build does not start unsupported new purchases',async()=>{
 const f=fixture();f.auth('account-a');
 const result=await f.buy();
 assert.equal(result.ok,false);assert.equal(result.reason,'no-new-purchases');
 assert.equal(f.purchases.length,0);assert.equal(f.requests.length,0);
 await f.listener(null,[f.tx()]);
 assert.equal(f.finished.length,0);assert.equal(f.events.length,0);
});
test('explicit restore finishes only after an active backend entitlement',async()=>{
 const f=fixture();f.auth('account-a');await f.restore();await f.listener(null,[f.tx({transactionState:'restored'})]);
 assert.equal(f.finished.length,1);assert.equal(f.events[0][0],'mr-iap-restored');
 assert.equal(f.requests[0].path,'/api/user/subscription');
});
for(const [label,response,status] of [
 ['missing success',{isActive:true,plan:'premium_monthly'},200],
 ['inactive',{success:true,isActive:false,plan:'premium_monthly'},200],
 ['unrecognized plan',{success:true,isActive:true,plan:'invented'},200],
 ['unavailable',{error:'unavailable'},503],
 ['conflicting owner',{error:'receipt_replay'},409],
]) test(`${label} restore neither finishes nor grants the purchase`,async()=>{
 const f=fixture(response);f.status=status;f.auth('account-a');await f.restore();await f.listener(null,[f.tx({transactionState:'restored'})]);
 assert.equal(f.finished.length,0);assert.equal(f.events[0][0],'mr-iap-failed');
 assert.equal(f.events[0][1].stage,'backend_verify');
});
test('unsolicited and old-account restored transactions are not assigned to a new login',async()=>{
 const f=fixture();f.auth('account-a');await f.restore();const old=f.tx({transactionState:'restored'});f.auth('account-b');await f.listener(null,[old]);
 assert.equal(f.requests.length,0);assert.equal(f.finished.length,0);
});
test('a purchased transaction cannot be assigned by a pending restore',async()=>{
 const f=fixture();f.auth('account-a');await f.restore();await f.listener(null,[f.tx({payment:{productIdentifier:'megaradio_premium_monthly1',applicationUsername:'different-owner'}})]);
 assert.equal(f.finished.length,0);assert.equal(f.requests.length,0);
});
test('explicit restore verifies the actual product before finishing',async()=>{
 const f=fixture({success:true,isActive:true,plan:'premium_lifetime'});f.auth('account-a');await f.restore();await f.listener(null,[f.tx({transactionState:'restored',payment:{productIdentifier:'megaradio_premium_lifetime'}})]);
 assert.equal(f.finished.length,1);assert.equal(f.events[0][0],'mr-iap-restored');
 assert.equal(f.events[0][1].productId,'megaradio_premium_lifetime');
 const verified=JSON.parse(f.bodies[0]);
 assert.equal(verified.productId,'megaradio_premium_lifetime');
 assert.equal(verified.receipt,Buffer.from('app-receipt').toString('base64'));
 assert.equal(f.events[0][1].server.plan,'premium_lifetime');
});

test('native rating trigger stays invisible and requests store review only when visible', async () => {
  const ts = require('../frontend/node_modules/typescript');
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../frontend/src/components/RateUsModal.tsx'),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
  }).outputText;
  let requested=0;let closed=0;
  const refs=[];let refIndex=0;
  const runtime={exports:{},console,require(name){
    if(name==='react')return {
      useRef:value=>refs[refIndex++] ||= {current:value},
      useEffect:effect=>effect(),
    };
    if(name==='../services/rateUsService')return {rateUsService:{requestReviewIfEligible:async()=>{requested++;return false;}}};
    throw Error(name);
  }};
  vm.runInNewContext(source,runtime);
  const render=visible=>{refIndex=0;return runtime.exports.RateUsModal({visible,onClose(){closed++;}});};
  assert.equal(render(false),null);assert.equal(requested,0);assert.equal(closed,0);
  assert.equal(render(true),null);assert.equal(requested,1);
  // A rerender while the native request is in flight must not open a second request.
  assert.equal(render(true),null);assert.equal(requested,1);
  await Promise.resolve();await Promise.resolve();
  assert.equal(closed,1);
  assert.equal(render(false),null);assert.equal(requested,1);
});

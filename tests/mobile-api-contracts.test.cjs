const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../frontend');
const ts = require(root + '/node_modules/typescript');
const axios = require(root + '/node_modules/axios/dist/node/axios.cjs');
const { createStore } = require(root + '/node_modules/zustand/vanilla');
const { QueryClient, QueryObserver } = require(root + '/node_modules/@tanstack/query-core');
const { Buffer } = require('node:buffer');
const quiet = { log(){},warn(){},error(){} };
const user = id => ({_id:id,id,name:id,email:id+'@example.invalid'});
const active = (plan='premium_monthly', expiryDate=new Date(Date.now()+86400000).toISOString()) => ({success:true,plan,isActive:true,expiryDate,features:['remove_ads','hd_stream']});
const inactive = {plan:'none',isActive:false,expiryDate:null,features:[]};
const purchase = {productId:'megaradio_premium_monthly1',transactionId:'txn-1',id:'txn-1',purchaseToken:'storekit2.jws.signature',purchaseState:'purchased',transactionDate:Date.now()};
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};

function fixture({platform='ios',storeTimeoutMs}={}) {
  const disk=new Map(), secure=new Map(), calls=[], modules=new Map();
  const storage={getItem:async k=>disk.get(k)||null,setItem:async(k,v)=>{disk.set(k,v);},removeItem:async k=>{disk.delete(k);},multiRemove:async keys=>keys.forEach(k=>disk.delete(k)),getAllKeys:async()=>[...disk.keys()],multiGet:async keys=>keys.map(k=>[k,disk.get(k)])};
  let handle=async config=>({status:200,data:config.url.includes('subscription')?inactive:[]});
  const adapter=async config=>{
    calls.push(config);
    if(config.signal?.aborted)throw new axios.CanceledError('aborted',config);
    const result=await handle(config);
    const response={status:result.status||200,statusText:'fixture',headers:{},config,data:result.data};
    if(response.status>=400)throw new axios.AxiosError('fixture rejection',null,config,{},response);
    return response;
  };
  const ax=axios.create({adapter});ax.create=opts=>axios.create({...opts,adapter});ax.CanceledError=axios.CanceledError;ax.AxiosHeaders=axios.AxiosHeaders;
  const iap={
    initConnection:async()=>true,endConnection:async()=>{},
    fetchProducts:async request=>{iap.productRequest=request;return Object.values(load('src/services/iapService.ts').PRODUCT_IDS).map(id=>({id,displayPrice:'€1.00',currency:'EUR',subscriptionOfferDetailsAndroid:[{offerId:null,offerToken:'base-offer'}]}));},
    purchaseUpdatedListener:fn=>(iap.listener=fn,{remove(){}}),purchaseErrorListener:fn=>(iap.errorListener=fn,{remove(){}}),
    requestPurchase:async request=>{iap.request=request;return purchase;},
    getReceiptIOS:async()=> 'ZmFrZS1yZWNlaXB0',requestReceiptRefreshIOS:async()=> 'cmVmcmVzaGVk',
    finishTransaction:async()=>{iap.finishes++;},finishes:0,getAvailablePurchases:async()=>[],
  };
  const queryClient=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  const mocks={
    axios:ax, 'react-native':{Platform:{OS:platform}}, buffer:{Buffer},
    zustand:{create:fn=>{const store=createStore(fn);return Object.assign(selector=>selector?selector(store.getState()):store.getState(),store);}},
    '@react-native-async-storage/async-storage':storage,
    'expo-secure-store':{getItemAsync:async k=>secure.get(k)||null,setItemAsync:async(k,v)=>{secure.set(k,v);},deleteItemAsync:async k=>{secure.delete(k);}},
    'react-native-iap':iap,
    'expo-constants':{expoConfig:{extra:{websiteUrl:'https://themegaradio.com'}}},
    'expo-notifications':{setNotificationHandler(){},getPermissionsAsync:async()=>({status:'granted'})},
    'expo-device':{isDevice:false},'expo-router':{router:{push(){}}},
    i18next:{language:'de'},
    '@tanstack/react-query':{QueryClient,useQuery:opts=>opts},
  };
  function load(relative) {
    let file=path.resolve(root,relative);
    if(!path.extname(file))file+='.ts';
    if(file.endsWith('/services/queryClient.ts'))return {queryClient};
    if(modules.has(file))return modules.get(file);
    const exports={};modules.set(file,exports);
    const source=fs.readFileSync(file,'utf8');
    const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(output,{exports,console:quiet,URL,AbortController,Date,Promise,
      setTimeout:storeTimeoutMs ? (fn,ms)=>setTimeout(fn,ms>=10000?storeTimeoutMs:ms) : setTimeout,clearTimeout,Buffer,
      require(name){if(name in mocks)return mocks[name];if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));throw Error('Unmocked import: '+name);},
    },{filename:file});
    return exports;
  }
  const auth=load('src/store/authStore.ts').useAuthStore;
  const runtime=load('src/services/sessionRuntime.ts');
  function login(id='a') {runtime.invalidateSession();auth.setState({user:user(id),token:'token-'+id,isAuthenticated:true,isAuthLoaded:true});}
  login();
  return {load,auth,login,runtime,disk,secure,storage,calls,iap,queryClient,network:fn=>{handle=fn;}};
}

test('product API sends platform and Bearer without cookies or an embedded API key',async()=>{
  const f=fixture();await f.load('src/services/api.ts').default.get('/api/stations');
  const c=f.calls.at(-1);assert.equal(c.headers.get('Authorization'),'Bearer token-a');assert.equal(c.headers.get('X-MegaRadio-Platform'),'ios');assert.equal(c.withCredentials,false);assert.equal(c.headers.has('X-API-Key'),false);
});
test('foreign origins are rejected before a request can send the Bearer',async()=>{
  const f=fixture();const count=f.calls.length;await assert.rejects(f.load('src/services/api.ts').default.get('https://external.invalid/test'));assert.equal(f.calls.length,count);
});
test('genres uses the canonical API with page and country preserved',async()=>{
  const f=fixture();f.network(async()=>({data:{data:[{slug:'pop',name:'Pop'}],total:82,page:2,limit:30,totalPages:3}}));
  const result=await f.load('src/services/genreService.ts').genreService.getGenres(2,30,'TR');
  const request=f.calls.at(-1);assert.equal(request.baseURL,'https://api.themegaradio.com');assert.equal(request.url,'/api/genres');
  assert.equal(request.params.page,2);assert.equal(request.params.country,'TR');assert.equal(result.data[0].slug,'pop');
});
test('precomputed genres sends the backend-supported country parameter',async()=>{
  const f=fixture();await f.load('src/services/genreService.ts').genreService.getPrecomputedGenres('TR');
  assert.equal(f.calls.at(-1).params.country,'TR');assert.equal(f.calls.at(-1).params.countrycode,undefined);
});
test('account changes cancel old successful API responses',async()=>{
  const f=fixture(),gate=deferred();f.network(()=>gate.promise);
  const request=f.load('src/services/api.ts').default.get('/api/user/favorites');
  await new Promise(r=>setImmediate(r));f.login('b');gate.resolve({status:200,data:['private-a']});
  await assert.rejects(request,e=>axios.isCancel(e));assert.equal(f.auth.getState().user._id,'b');
});
test('401 from an old account never expires a new account',async()=>{
  const f=fixture(),gate=deferred();f.network(()=>gate.promise);
  const request=f.load('src/services/api.ts').default.get('/api/user/favorites');await new Promise(r=>setImmediate(r));f.login('b');gate.resolve({status:401,data:{}});
  await assert.rejects(request);assert.equal(f.auth.getState().token,'token-b');
});
test('listening sends listenDuration in seconds',async()=>{
  const f=fixture();await f.load('src/services/userService.ts').userService.recordListening('station',42,'unused');
  const body=JSON.parse(f.calls.at(-1).data);assert.equal(body.listenDuration,42);assert.equal(body.duration,undefined);
});
test('stream resolver and proxy use the stream origin without user credentials',async()=>{
  const f=fixture();f.network(async()=>({data:{candidates:['https://radio.invalid/live']}}));
  const stream=f.load('src/services/streamService.ts').streamService;
  await stream.resolve('https://radio.invalid/radio.pls');const c=f.calls.at(-1);
  assert.equal(c.baseURL,'https://stream.themegaradio.com');assert.equal(c.headers.has('Authorization'),false);assert.equal(c.headers.has('X-MegaRadio-Platform'),false);assert.equal(c.withCredentials,false);
  const url='https://radio.invalid/live?q=ä';assert.equal(Buffer.from(stream.proxyUrl(url).split('/').at(-1),'base64url').toString('utf8'),url);
});
for(const status of [400,409,503])test(`purchase rejection ${status} never grants premium or finishes the transaction`,async()=>{
  const f=fixture();f.network(async()=>({status,data:{error:'Rejected'}}));
  const service=f.load('src/services/iapService.ts').iapService;
  await assert.rejects(service.purchaseSubscription(purchase.productId));
  assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().plan,'none');assert.equal(f.iap.finishes,0);
});
test('iOS sends base64 app receipt, uses server expiry and finishes only after approval',async()=>{
  const f=fixture(),expiry=new Date(Date.now()+3*86400000).toISOString();
  f.network(async c=>{assert.equal(f.iap.finishes,0);const body=JSON.parse(c.data);assert.equal(body.receipt,'ZmFrZS1yZWNlaXB0');assert.equal(body.purchaseToken,undefined);return{data:active('premium_monthly',expiry)};});
  const service=f.load('src/services/iapService.ts').iapService;
  assert.equal(await service.purchaseSubscription(purchase.productId),true);assert.equal(f.iap.finishes,1);
  assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().expiryDate,expiry);assert.equal(f.iap.productRequest.type,'all');
});
test('missing Apple app receipt is refreshed instead of substituting JWS',async()=>{
  const f=fixture();f.iap.getReceiptIOS=async()=>{throw Error('missing');};f.network(async()=>({data:active()}));
  await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId);
  assert.equal(JSON.parse(f.calls.at(-1).data).receipt,'cmVmcmVzaGVk');
});
test('Android subscriptions include the store offer and real purchase token',async()=>{
  const f=fixture({platform:'android'});f.network(async()=>({data:active()}));
  await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId);
  assert.equal(f.iap.request.request.google.subscriptionOffers[0].offerToken,'base-offer');
  assert.equal(JSON.parse(f.calls.at(-1).data).purchaseToken,purchase.purchaseToken);
});
test('purchase cannot be attributed to another account while verification is pending',async()=>{
  const f=fixture(),gate=deferred();f.network(()=>gate.promise);
  const service=f.load('src/services/iapService.ts').iapService;const result=service.purchaseSubscription(purchase.productId);
  await new Promise(r=>setImmediate(r));f.login('b');gate.resolve({data:active()});await assert.rejects(result);
  assert.equal(f.iap.finishes,0);assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().plan,'none');
});
test('unsolicited delayed purchase callback waits for explicit restore',async()=>{
  const f=fixture();await f.load('src/services/iapService.ts').iapService.initialize();
  await f.iap.listener(purchase);assert.equal(f.iap.finishes,0);assert.equal(f.calls.some(c=>c.url.includes('subscription')),false);
});
test('inactive server and same-plan renewal both replace the local entitlement',async()=>{
  const f=fixture();let data=active();f.network(async()=>({data}));const service=f.load('src/services/iapService.ts').iapService;
  await service.syncSubscriptionFromBackend();const premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  data=active('premium_monthly',new Date(Date.now()+8*86400000).toISOString());await service.syncSubscriptionFromBackend();assert.equal(premium.getState().expiryDate,data.expiryDate);
  data=inactive;await service.syncSubscriptionFromBackend();assert.equal(premium.getState().plan,'none');
});
test('expired annual remove_ads and unverified legacy cache cannot grant access',async()=>{
  const f=fixture(),premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  f.disk.set('megaradio_premium_status',JSON.stringify({plan:'premium_lifetime'}));
  f.disk.set('megaradio_verified_premium_v2:a',JSON.stringify({...active('remove_ads','2020-01-01T00:00:00Z'),ownerId:'a',verifiedAt:Date.now()}));
  await premium.getState().loadPremiumStatus();assert.equal(premium.getState().isRemoveAds,false);assert.equal(premium.getState().plan,'none');
});
test('account B never hydrates A premium or listening history',async()=>{
  const f=fixture();f.disk.set('@megaradio_v3:recent:a',JSON.stringify([{_id:'a-private'}]));f.disk.set('megaradio_recently_played',JSON.stringify([{_id:'legacy-private'}]));
  f.disk.set('megaradio_verified_premium_v2:a',JSON.stringify({...active(),ownerId:'a',verifiedAt:Date.now()}));
  f.login('b');const history=f.load('src/store/recentlyPlayedStore.ts').useRecentlyPlayedStore;await history.getState().loadFromAPI();
  await f.load('src/store/premiumStore.ts').usePremiumStore.getState().loadPremiumStatus();assert.equal(history.getState().stations.length,0);assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().plan,'none');
});
test('late history response does not overwrite a station just played',async()=>{
  const f=fixture(),gate=deferred();f.network(c=>c.method==='get'?gate.promise:Promise.resolve({data:{}}));
  const store=f.load('src/store/recentlyPlayedStore.ts').useRecentlyPlayedStore;const loading=store.getState().loadFromAPI();await new Promise(r=>setImmediate(r));
  store.getState().addStation({_id:'new',name:'new'});gate.resolve({data:[{_id:'old'}]});await loading;assert.equal(store.getState().stations[0]._id,'new');
});
test('successful empty favorites remain empty instead of resurrecting an old backup',async()=>{
  const f=fixture();f.disk.set('@megaradio_favorites_backup_a',JSON.stringify([{_id:'deleted'}]));f.network(async()=>({data:[]}));
  const store=f.load('src/store/favoritesStore.ts').useFavoritesStore;await store.getState().loadFavorites();assert.equal(store.getState().favorites.length,0);assert.equal(f.calls.some(c=>c.method==='post'),false);
});
test('logout clears memory and revokes the captured token',async()=>{
  const f=fixture();f.network(async()=>({data:{success:true}}));
  await f.auth.getState().logout();assert.equal(f.auth.getState().token,null);
  const c=f.calls.find(c=>c.url.endsWith('/api/auth/mobile/logout'));assert.ok(c);assert.equal(c.headers.get('Authorization'),'Bearer token-a');assert.equal(c.withCredentials,false);
});
test('offline logout retains a secure revocation job and retries it later',async()=>{
  const f=fixture();f.network(async()=>{throw Error('offline');});await f.auth.getState().logout();assert.ok(f.secure.has('megaradio_pending_revocations'));
  f.network(async()=>({data:{success:true}}));await f.load('src/services/authRevocationService.ts').revokeSession();assert.equal(f.secure.has('megaradio_pending_revocations'),false);
});
test('temporary auth outage preserves session while authenticated:false expires it',async()=>{
  const f=fixture();f.network(async()=>({status:503,data:{}}));await f.auth.getState().revalidateSession();assert.equal(f.auth.getState().token,'token-a');
  f.network(async c=>({data:c.url.includes('/mobile/me')?{authenticated:false}:{success:true}}));await f.auth.getState().revalidateSession();assert.equal(f.auth.getState().token,null);
});
test('503 remains an error and does not overwrite the last successful catalog cache',async()=>{
  const f=fixture();f.network(async()=>({status:503,data:{error:'unavailable'}}));
  const hooks=f.load('src/hooks/useQueries.ts'),options=hooks.useStations({country:'AT'});
  await assert.rejects(options.queryFn());assert.equal([...f.disk.keys()].some(k=>k.startsWith('dc:catalog:')),false);
});
test('disk keys distinguish filters, limits and endpoints and old data refetches',async()=>{
  const f=fixture(),hooks=f.load('src/hooks/useQueries.ts');
  assert.notEqual(JSON.stringify(hooks.usePrecomputedStations('TR','Turkey').queryKey),JSON.stringify(hooks.usePrecomputedStations('TR','Türkiye').queryKey));
  assert.notEqual(hooks.catalogCacheKey('stations',{country:'AT',limit:21}),hooks.catalogCacheKey('stations',{country:'AT',limit:100}));
  assert.notEqual(hooks.catalogCacheKey('stations',{genre:'rock'}),hooks.catalogCacheKey('stations',{genre:'pop'}));
  assert.notEqual(hooks.catalogCacheKey('stations',{page:1}),hooks.catalogCacheKey('precomputed',{page:1}));
  assert.equal(hooks.catalogCacheKey('stations',{country:'AT',limit:21}),hooks.catalogCacheKey('stations',{limit:21,country:'AT'}));
  const options=hooks.useStations({country:'AT'});const client=new QueryClient();let fetched=0;
  const observer=new QueryObserver(client,{...options,gcTime:0,initialData:{stations:[]},initialDataUpdatedAt:Date.now()-120000,queryFn:async()=>{fetched++;return{stations:[]};}});
  const unsubscribe=observer.subscribe(()=>{});await new Promise(r=>setImmediate(r));assert.equal(fetched,1);unsubscribe();client.clear();
});
test('notification toggle patches flat booleans and restores previous categories',async()=>{
  const f=fixture();let settings={favorites:true,nowPlaying:false,newStations:true,recommendations:false};
  f.network(async c=>{if(c.method==='patch')settings=JSON.parse(c.data);return{data:{notificationSettings:settings}};});
  const service=f.load('src/services/notificationSettingsService.ts').notificationSettingsService;
  await service.setEnabled(false);assert.equal(Object.values(settings).some(Boolean),false);
  await service.setEnabled(true);assert.equal(settings.favorites,true);assert.equal(settings.nowPlaying,false);assert.equal(settings.newStations,true);
});
test('all 14 localized station/user/genre route families map to native screens',()=>{
  const f=fixture(),routes=f.load('src/utils/localizedRoutes.ts'),link=f.load('src/utils/incomingLinks.ts').incomingLinkPath;
  for(const [language,mapping] of Object.entries(routes.LOCALIZED_ROUTES)) {
    assert.match(link('https://themegaradio.com'+routes.localizedSharePath('stations','fixture',language)),/^\/open-link\?type=station/);
    assert.match(link('https://themegaradio.com'+routes.localizedSharePath('users','fixture',language)),/^\/open-link\?type=user/);
    assert.match(link(`https://themegaradio.com/${language}/${mapping.genres}/pop`),/^\/genre-detail/);
  }
  assert.equal(link('https://foreign.invalid/de/sender/test'),'https://foreign.invalid/de/sender/test');
  assert.equal(link('https://themegaradio.com/de/sender/%252e%252e'),'/link-error');
});


test('invalid login does not expire an already signed-in session',async()=>{
  const f=fixture();f.network(async()=>({status:401,data:{error:'Invalid password'}}));
  await assert.rejects(f.load('src/services/api.ts').default.post('/api/auth/mobile/login',{email:'bad',password:'bad'}));
  assert.equal(f.auth.getState().token,'token-a');assert.equal(f.calls.at(-1).headers.has('Authorization'),false);
});
test('guest purchases are rejected before opening the store',async()=>{
  const f=fixture();f.auth.setState({user:null,token:null,isAuthenticated:false});
  await assert.rejects(f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId),/Sign in/);
  assert.equal(f.iap.request,undefined);assert.equal(f.iap.finishes,0);
});
test('SDK callback plus returned purchase verifies and finishes exactly once',async()=>{
  const f=fixture();f.network(async()=>({data:active()}));
  f.iap.requestPurchase=async()=>{void f.iap.listener(purchase);return purchase;};
  await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId);
  assert.equal(f.calls.filter(c=>c.url.includes('subscription')&&c.method==='post').length,1);assert.equal(f.iap.finishes,1);
});
test('restore revalidates a previously approved purchase and respects a later conflict',async()=>{
  const f=fixture();f.network(async()=>({data:active()}));const service=f.load('src/services/iapService.ts').iapService;
  await service.purchaseSubscription(purchase.productId);
  f.iap.getAvailablePurchases=async()=>[purchase];
  f.network(async()=>({status:409,data:{error:'Receipt belongs to another account'}}));
  await assert.rejects(service.restorePurchases());assert.equal(f.iap.finishes,1);
  assert.equal(f.calls.filter(c=>c.method==='post').length,2);
});

test('active yearly Premium never opens another purchase sheet, including Remove Ads',async()=>{
  const f=fixture(),premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  await premium.getState().applyEntitlement(active('premium_yearly'),'a');
  const {iapService,PRODUCT_IDS}=f.load('src/services/iapService.ts');
  for(const id of Object.values(PRODUCT_IDS))assert.equal(await iapService.purchaseSubscription(id),true);
  assert.equal(f.iap.request,undefined);assert.equal(f.calls.length,0);
});
test('ad-free annual ownership blocks its own repurchase but permits Premium upgrade',async()=>{
  const f=fixture(),premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  await premium.getState().applyEntitlement(active('remove_ads'),'a');
  const {iapService,PRODUCT_IDS}=f.load('src/services/iapService.ts');
  assert.equal(await iapService.purchaseSubscription(PRODUCT_IDS.REMOVE_ADS_YEARLY),true);
  assert.equal(f.iap.request,undefined);
  f.network(async()=>({data:active()}));
  assert.equal(await iapService.purchaseSubscription(purchase.productId),true);
  assert.ok(f.iap.request);
});
test('StoreKit ownership after interrupted checkout verifies without a second payment sheet',async()=>{
  const f=fixture();f.iap.getAvailablePurchases=async()=>[purchase];f.network(async()=>({data:active()}));
  assert.equal(await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId),true);
  assert.equal(f.iap.request,undefined);assert.equal(f.iap.finishes,1);
  assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().isPremium,true);
});
test('StoreKit-owned subscription still cannot bypass backend receipt ownership checks',async()=>{
  const f=fixture();f.iap.getAvailablePurchases=async()=>[purchase];f.network(async()=>({status:409,data:{error:'receipt_replay'}}));
  await assert.rejects(f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId),e=>e.response?.status===409);
  assert.equal(f.iap.request,undefined);assert.equal(f.iap.finishes,0);
  assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().isPremium,false);
});
test('two rapid taps cannot start overlapping ownership checks or payment sheets',async()=>{
  const f=fixture(),gate=deferred();f.iap.getAvailablePurchases=()=>gate.promise;f.network(async()=>({data:active()}));
  const service=f.load('src/services/iapService.ts').iapService;
  const first=service.purchaseSubscription(purchase.productId);
  await assert.rejects(service.purchaseSubscription(purchase.productId),/already in progress/);
  await assert.rejects(service.restorePurchases(),/already in progress/);
  gate.resolve([]);assert.equal(await first,true);
});
test('late inactive subscription GET cannot undo a newly verified purchase',async()=>{
  const f=fixture(),gate=deferred();f.network(c=>c.method==='get'?gate.promise:Promise.resolve({data:active()}));
  const service=f.load('src/services/iapService.ts').iapService;
  const sync=service.syncSubscriptionFromBackend();await new Promise(r=>setImmediate(r));
  await service.purchaseSubscription(purchase.productId);gate.resolve({data:inactive});await sync;
  assert.equal(f.load('src/store/premiumStore.ts').usePremiumStore.getState().isPremium,true);
});
test('a cache hydrated during subscription sync does not hide a server cancellation',async()=>{
  const f=fixture(),gate=deferred();f.network(()=>gate.promise);
  const service=f.load('src/services/iapService.ts').iapService,premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  const sync=service.syncSubscriptionFromBackend();await new Promise(r=>setImmediate(r));
  f.disk.set('megaradio_verified_premium_v2:a',JSON.stringify({...active('premium_yearly'),ownerId:'a',verifiedAt:Date.now()-60000}));
  await premium.getState().loadPremiumStatus();assert.equal(premium.getState().isPremium,true);
  gate.resolve({data:inactive});await sync;assert.equal(premium.getState().isPremium,false);
});
test('restore with no store transactions recognizes a verified server subscription',async()=>{
  const f=fixture();f.network(async()=>({data:active('premium_yearly')}));
  assert.equal(await f.load('src/services/iapService.ts').iapService.restorePurchases(),true);
  assert.equal(f.iap.finishes,0);
});
test('already-owned store error recovers rather than leaving checkout loading',async()=>{
  const f=fixture();let reads=0;
  f.iap.getAvailablePurchases=async()=>++reads===1?[]:[purchase];
  f.iap.requestPurchase=async()=>{throw Object.assign(new Error('Owned'),{code:'already-owned'});};
  f.network(async()=>({data:active()}));
  assert.equal(await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId),true);
  assert.equal(f.iap.finishes,1);
});
test('already-owned error callback also reconciles the existing entitlement',async()=>{
  const f=fixture();let reads=0;
  f.iap.getAvailablePurchases=async()=>++reads===1?[]:[purchase];
  f.iap.requestPurchase=async()=>{f.iap.errorListener({code:'already-owned'});return null;};
  f.network(async()=>({data:active()}));
  assert.equal(await f.load('src/services/iapService.ts').iapService.purchaseSubscription(purchase.productId),true);
  assert.equal(f.iap.finishes,1);
});
test('a stalled StoreKit ownership lookup ends and the next attempt can proceed',async()=>{
  const f=fixture({storeTimeoutMs:20});f.iap.getAvailablePurchases=()=>new Promise(()=>{});
  const service=f.load('src/services/iapService.ts').iapService;
  await assert.rejects(service.restorePurchases(),/did not return/);
  f.iap.getAvailablePurchases=async()=>[];f.network(async()=>({data:inactive}));
  assert.equal(await service.restorePurchases(),false);
});
test('a stalled Apple receipt refresh cannot leave Restore loading indefinitely',async()=>{
  const f=fixture({storeTimeoutMs:20});f.iap.getAvailablePurchases=async()=>[purchase];
  f.iap.getReceiptIOS=async()=>'';f.iap.requestReceiptRefreshIOS=()=>new Promise(()=>{});
  const service=f.load('src/services/iapService.ts').iapService;
  await assert.rejects(service.restorePurchases(),/receipt verification is pending/);
  assert.equal(f.iap.finishes,0);
  f.iap.getReceiptIOS=async()=>'ZmFrZS1yZWNlaXB0';f.network(async()=>({data:active()}));
  assert.equal(await service.restorePurchases(),true);
});
test('premium flags expire while the application stays open',async()=>{
  const f=fixture(),premium=f.load('src/store/premiumStore.ts').usePremiumStore;
  await premium.getState().applyEntitlement(active('remove_ads',new Date(Date.now()+80).toISOString()),'a');
  assert.equal(premium.getState().isRemoveAds,true);await new Promise(r=>setTimeout(r,110));
  assert.equal(premium.getState().isRemoveAds,false);assert.equal(premium.getState().hasFeature('remove_ads'),false);
});
test('late premium disk hydration never overwrites a newer server entitlement',async()=>{
  const f=fixture(),premium=f.load('src/store/premiumStore.ts').usePremiumStore,gate=deferred();
  f.storage.getItem=async key=>key.includes('verified_premium')?gate.promise:null;
  const loading=premium.getState().loadPremiumStatus();await new Promise(r=>setImmediate(r));
  const verifiedAt=Date.now()-1000;await premium.getState().applyEntitlement(active('premium_lifetime',null),'a');
  gate.resolve(JSON.stringify({...inactive,ownerId:'a',verifiedAt}));await loading;assert.equal(premium.getState().plan,'premium_lifetime');
});
test('actual account switch clears private memory and ignores the previous account load',async()=>{
  const f=fixture(),gate=deferred();f.network(async c=>c.url.includes('favorites')&&c.headers.get('Authorization')==='Bearer token-a'?gate.promise:{data:c.url.includes('subscription')?inactive:[]});
  const a=f.auth.getState().saveAuth(user('a'),'token-a');await new Promise(r=>setImmediate(r));
  f.queryClient.setQueryData(['notifications','a'],['private-a']);
  const b=f.auth.getState().saveAuth(user('b'),'token-b');await b;gate.resolve({data:[{_id:'private-a'}]});await a;
  assert.equal(f.auth.getState().user._id,'b');assert.equal(f.secure.get('megaradio_auth_token'),'token-b');
  assert.equal(f.queryClient.getQueryData(['notifications','a']),undefined);assert.equal(f.load('src/store/favoritesStore.ts').useFavoritesStore.getState().favorites.length,0);
});
test('new favorite operations survive an older in-flight operation for the same station',async()=>{
  const f=fixture(),gate=deferred();let posts=0;
  f.network(async c=>{if(c.method==='post'&&++posts===1)return gate.promise;return {data:{success:true}};});
  const store=f.load('src/store/favoritesStore.ts').useFavoritesStore;
  const first=store.getState().addFavorite({_id:'station',name:'Station'});await new Promise(r=>setImmediate(r));
  const remove=store.getState().removeFavorite('station');const add=store.getState().addFavorite({_id:'station',name:'Station'});
  await new Promise(r=>setImmediate(r));gate.resolve({data:{success:true}});await Promise.all([first,remove,add]);
  assert.equal(posts,2);assert.equal(store.getState().isFavorite('station'),true);assert.equal(f.disk.get('@megaradio_v3:favorite_queue:a'),'[]');
});
test('a late favorites GET cannot erase a favorite added meanwhile',async()=>{
  const f=fixture(),gate=deferred();f.network(async c=>c.method==='get'?gate.promise:{data:{success:true}});
  const store=f.load('src/store/favoritesStore.ts').useFavoritesStore;const loading=store.getState().loadFavorites();await new Promise(r=>setImmediate(r));
  await store.getState().addFavorite({_id:'new',name:'New'});gate.resolve({data:[]});await loading;assert.equal(store.getState().isFavorite('new'),true);
});
test('superseded search is cancelled and shared lookup lists are reused',async()=>{
  const f=fixture(),gate=deferred();f.network(async c=>c.params?.search==='old'?gate.promise:{data:c.url.includes('stations')?{stations:[{_id:'new'}]}:[]});
  const search=f.load('src/services/searchService.ts').searchCatalog;const oldController=new AbortController();
  const old=search('old',oldController.signal);await new Promise(r=>setImmediate(r));oldController.abort();
  const latest=await search('new',new AbortController().signal);gate.resolve({data:{stations:[{_id:'old'}]}});
  await assert.rejects(old,e=>axios.isCancel(e));assert.equal(latest.stations[0]._id,'new');
  assert.equal(f.calls.filter(c=>c.url.includes('discoverable')).length,1);
});


test('expired logout jobs do not block revoking later sessions',async()=>{
  const f=fixture();f.secure.set('megaradio_pending_revocations',JSON.stringify(['expired-token']));
  f.network(async c=>({status:c.headers.get('Authorization')==='Bearer expired-token'?401:200,data:{success:true}}));
  await f.load('src/services/authRevocationService.ts').revokeSession('token-a');
  assert.equal(f.secure.has('megaradio_pending_revocations'),false);assert.equal(f.calls.at(-1).headers.get('Authorization'),'Bearer token-a');
});
test('offline favorites stay in their owner queue across accounts',async()=>{
  const f=fixture();f.network(async()=>{throw Error('offline');});
  const store=f.load('src/store/favoritesStore.ts').useFavoritesStore;await store.getState().addFavorite({_id:'private-a',name:'A'});
  assert.match(f.disk.get('@megaradio_v3:favorite_queue:a'),/private-a/);
  const before=f.calls.length;f.network(async c=>({data:c.url.includes('subscription')?inactive:[]}));
  await f.auth.getState().saveAuth(user('b'),'token-b');
  assert.equal(f.calls.slice(before).some(c=>c.method==='post'),false);assert.equal(store.getState().favorites.length,0);
});
test('Android manifest and Expo config both accept each localized share link',()=>{
  const f=fixture(),routes=f.load('src/utils/localizedRoutes.ts');
  const manifest=fs.readFileSync(root+'/android/app/src/main/AndroidManifest.xml','utf8');
  const data=JSON.parse(fs.readFileSync(root+'/app.json','utf8')).expo.android.intentFilters.flatMap(f=>f.data);
  for(const [language,mapping] of Object.entries(routes.LOCALIZED_ROUTES))for(const segment of new Set(Object.values(mapping))){
    const prefix=`/${language}/${segment}/`;
    assert.ok(manifest.includes(`android:pathPrefix="${prefix}"`),prefix);
    assert.ok(data.some(d=>d.host==='themegaradio.com'&&d.pathPrefix===prefix),prefix);
  }
});

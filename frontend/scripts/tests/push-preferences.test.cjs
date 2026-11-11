const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:id=>{if(!(id in mocks))throw Error('Unexpected module '+id);return mocks[id];},console:{log(){},error(){}},setTimeout,clearTimeout});return mod.exports;}
const tick=()=>new Promise(r=>setImmediate(r));
function hookHarness({native=false,fail=false,deferred,denied=false}={}){
 const state={owner:'a',auth:true},slots=[],pending=[],notices=[],saved=[];let cursor=0;
 const equal=(a,b)=>!!a&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 const React={
  useState(value){const i=cursor++;if(!slots[i])slots[i]={value};return[slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
  useRef(value){const i=cursor++;if(!slots[i])slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps))slots[i]={deps,fn};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(!equal(slots[i]?.deps,deps)){slots[i]?.cleanup?.();slots[i]={deps};pending.push(()=>{slots[i].cleanup=fn();});}},
 };
 const prefs={getPushPreference:async()=>true,readCachedPushPreference:async()=>undefined,cachePushPreference:async()=>{},savePushPreference:async(owner,value)=>{saved.push([owner,value]);if(deferred)await deferred.promise;if(fail)throw Error('offline');}};
 const usePushPreferences=load('src/hooks/usePushPreferences.ts',{react:React,'react-native':{Platform:{OS:native?'ios':'web'},AppState:{addEventListener:()=>({remove(){}})}},'../store/authStore':{useAuthStore:{getState:()=>({user:{_id:state.owner},isAuthenticated:state.auth})}},'../services/notificationPreferences':prefs,'expo-notifications':{getPermissionsAsync:async()=>({granted:!denied,canAskAgain:false})},'../services/pushNotificationService':{registerForPushNotifications:async()=>denied?null:'fixture-token',sendPushTokenToBackend:async()=>{}}}).usePushPreferences;
 const notice=(...n)=>notices.push(n);
 return{state,notices,saved,render(){cursor=0;const result=usePushPreferences(state.owner,state.auth,notice);pending.splice(0).forEach(f=>f());return result;}};
}
(async()=>{
 const disk=new Map();let failure=false,ackMismatch=false,writeFails=false;const api={get:async()=>({data:{notificationSettings:{pushEnabled:true}}}),patch:async(_,body)=>{if(failure)throw Error('offline');return{data:{notificationSettings:{pushEnabled:ackMismatch?!body.pushEnabled:body.pushEnabled}}};}};
 const prefs=load('src/services/notificationPreferences.ts',{'@react-native-async-storage/async-storage':{getItem:async k=>disk.get(k)||null,setItem:async(k,v)=>{if(writeFails)throw Error('disk');disk.set(k,v);}},'./api':api});
 assert.equal(await prefs.getPushPreference('a'),true);await prefs.savePushPreference('a',false);assert.equal(await prefs.readCachedPushPreference('a'),false);assert.equal(await prefs.readCachedPushPreference('b'),undefined);assert.equal(disk.has('@megaradio_notifications_enabled'),false);
 await prefs.cachePushPreference('a',true);failure=true;await assert.rejects(prefs.savePushPreference('a',false));assert.equal(await prefs.readCachedPushPreference('a'),true);failure=false;
 ackMismatch=true;await assert.rejects(prefs.savePushPreference('a',false));assert.equal(await prefs.readCachedPushPreference('a'),true);ackMismatch=false;
 writeFails=true;await prefs.savePushPreference('a',false);assert.equal(await prefs.readCachedPushPreference('a'),false);writeFails=false;
 console.log('PASS server acknowledgement, opt-out rollback, account-isolated cache and optional disk failure');
 let h=hookHarness();h.render();await tick();let view=h.render();assert.equal(view.ready,true);assert.equal(view.enabled,true);await view.toggle(false);view=h.render();assert.equal(view.enabled,false);assert.equal(h.notices.at(-1)[1],'push_now_disabled_short');await view.toggle(true);assert.equal(h.render().enabled,true);
 h=hookHarness({fail:true});h.render();await tick();view=h.render();await view.toggle(false);assert.equal(h.render().enabled,true);assert.equal(h.notices.at(-1)[1],'push_save_failed');
 let resolve;const promise=new Promise(r=>resolve=r);h=hookHarness({deferred:{promise}});h.render();await tick();view=h.render();const pending=view.toggle(false);assert.equal(h.render().enabled,false,'switch changes before response');await view.toggle(false);assert.equal(h.saved.length,1,'double taps cannot duplicate writes');h.state.owner='b';h.render();await tick();resolve();await pending;assert.equal(h.notices.length,0,'old account cannot notify new account');
 h=hookHarness({native:true,denied:true});h.render();await tick();view=h.render();await view.toggle(true);assert.equal(h.saved.length,0,'no server opt-in without system permission');assert.equal(h.render().needsSettings,true);assert.equal(h.notices.at(-1)[1],'push_permission_required');
 console.log('PASS immediate on/off, save failure rollback, double tap, owner change and OS permission handling');
 let handler,prompts=0;let owner='a',local=false;
 const push=load('src/services/pushNotificationService.ts',{'axios':{},'../store/accountScope':{captureAccount:()=>({ownerId:owner,token:owner?'token':null}),isAccountCurrent:s=>s.ownerId===owner},'./notificationSettingsService':{notificationSettingsService:{enabled:async()=>local}},'expo-notifications':{setNotificationHandler:h=>handler=h,getPermissionsAsync:async()=>({status:'denied'}),requestPermissionsAsync:async()=>{prompts++;return{status:'denied'};}},'expo-device':{isDevice:true},'expo-constants':{},'react-native':{Platform:{OS:'ios'}},'@react-native-async-storage/async-storage':{},'expo-router':{router:{}},'./api':{},'../constants/api':{API_ENDPOINTS:{}},'./notificationPreferences':{readCachedPushPreference:async()=>local,savePushPreference:async()=>{}},'../store/authStore':{useAuthStore:{getState:()=>({isAuthenticated:!!owner,user:{_id:owner}})}}}).default;
 await push.registerForPushNotifications();assert.equal(prompts,0,'login must not prompt');await push.registerForPushNotifications({requestPermission:true});assert.equal(prompts,1);
 assert.equal((await handler.handleNotification()).shouldShowBanner,false);local=true;assert.equal((await handler.handleNotification()).shouldShowBanner,true);owner='';assert.equal((await handler.handleNotification()).shouldShowBanner,false);
 console.log('PASS silent native startup, explicit permission prompt and active-account foreground suppression');
})().catch(e=>{console.error(e);process.exitCode=1;});

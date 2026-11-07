import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { AD_POLICY, canShowStationAd } from '../../src/utils/adPolicy.ts';

const eligible = { now: 600000, sessionStartedAt: 0, lastFullScreenAt: 0, stationChanges: 5, automaticAdsThisSession: 0, foreground: true, adFree: false, showing: false };
test('station ads need BOTH listening grace and sufficient explicit changes', () => {
  assert.equal(canShowStationAd(eligible), true);
  for (const changed of [{now:599999}, {stationChanges:4}, {lastFullScreenAt:1}, {foreground:false}, {adFree:true}, {showing:true}, {automaticAdsThisSession:3}]) {
    assert.equal(canShowStationAd({...eligible, ...changed}), false, JSON.stringify(changed));
  }
});

function fixture(platform='android') {
  let now = 1000000;
  let premium = false;
  let playing = true;
  let storageUnavailable = false;
  const storage = new Map();
  const calls = [];
  const appState = { currentState:'active' };
  function ad() {
    const listeners = new Map();
    return {
      addAdEventListener(type, fn) { const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);return ()=>set.delete(fn); },
      emit(type, value) { for(const fn of [...(listeners.get(type)||[])]) fn(value); },
      removeAllListeners() { listeners.clear(); },
      async show() { calls.push('show'); this.emit('opened'); },
      load() {},
    };
  }
  const sdk = { AdEventType:{OPENED:'opened',CLOSED:'closed',ERROR:'error'}, RewardedAdEventType:{LOADED:'loaded',EARNED_REWARD:'earned'}, RewardedInterstitialAd:{ createForAdRequest:ad }, InterstitialAd:{createForAdRequest:ad} };
  const source=ts.transpileModule(fs.readFileSync(new URL('../../src/services/adMobService.native.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const exports={};
  class Clock extends Date { static now(){return now;} }
  vm.runInNewContext(source, {exports, Date:Clock, console:{log(){},error(){}},setTimeout,clearTimeout,__DEV__:false, require(name){
    if(name==='react-native')return {AppState:appState,Platform:{OS:platform},NativeModules:{},StatusBar:{setHidden(){}}};
    if(name==='@react-native-async-storage/async-storage')return {getItem:async k=>{if(storageUnavailable)throw Error('storage unavailable');return storage.get(k)||null;},setItem:async(k,v)=>{if(storageUnavailable)throw Error('storage unavailable');storage.set(k,v);}};
    if(name==='../utils/adConsent')return {prepareAdConsent:async()=>true};
    if(name==='../utils/adPolicy')return {AD_POLICY,canShowStationAd};
    if(name==='../store/premiumStore')return {usePremiumStore:{getState:()=>({hasFeature:()=>premium})}};
    if(name==='react-native-google-mobile-ads')return sdk;
    if(name==='react-native-track-player')return {default:{getPlaybackState:async()=>({state:playing?'playing':'paused'}),getActiveTrack:async()=>({id:'station-a'}),pause:async()=>{calls.push('pause');playing=false;},play:async()=>{calls.push('resume');playing=true;}}};
    if(name==='./analyticsService')return {analyticsService:{logDiagnosticEvent:async n=>{calls.push(n);}}};
    throw Error(name);
  }});
  const service=exports.adMobService;service.isInitialized=true;
  const interstitial=ad(), rewarded=ad();
  service.interstitialAd=interstitial; service.isInterstitialLoaded=true; service.rewardedAd=rewarded; service.isRewardedLoaded=true;
  return {service,interstitial,rewarded,storage,calls,appState,advance(ms){now+=ms;},premium(){premium=true;},failStorage(){storageUnavailable=true;}};
}
const tick=()=>new Promise(r=>setImmediate(r));

for (const platform of ['ios','android']) {
 test(`${platform}: first play/grace skipped; transition waits until ad dismissal; reward never automatic`, async()=>{
  const f=fixture(platform);
  assert.equal(await f.service.showAppOpenAd(),false);
  for(let i=0;i<6;i++)assert.equal(await f.service.onStationChange(),false);
  f.advance(600000);
  let completed=false; const result=f.service.onStationChange().then(x=>{completed=true;return x;});await tick();
  assert.equal(completed,false);assert.ok(f.calls.includes('pause'));assert.equal(f.calls.filter(x=>x==='show').length,1);
  f.interstitial.emit('closed');assert.equal(await result,true);assert.equal(f.calls.includes('resume'),false);
  // Missing interstitial never silently converts a reward ad into an interruption.
  f.advance(600000);f.service.isInterstitialLoaded=false;f.service.loadInterstitialAd=async()=>{};
  for(let i=0;i<5;i++)assert.equal(await f.service.onStationChange(),false);
  assert.equal(f.calls.filter(x=>x==='show').length,1);
 });
 test(`${platform}: reward is granted once on earned event, resolves on close and resumes listening`, async()=>{
  const f=fixture(platform);let completed=false;const result=f.service.showRewardedAd().then(x=>{completed=true;return x;});await tick();
  assert.deepEqual(f.calls.filter(x=>['pause','show'].includes(x)),['pause','show']);
  f.rewarded.emit('earned',{type:'minutes',amount:1});f.rewarded.emit('earned',{type:'minutes',amount:1});await tick();
  assert.equal(completed,false);assert.equal(await f.service.getAdFreeMinutesRemaining(),30);
  f.rewarded.emit('closed');assert.equal((await result).success,true);assert.ok(f.calls.includes('resume'));
  assert.equal(f.calls.filter(x=>x==='ad_reward_earned').length,1);
 });
 test(`${platform}: cancelled reward grants nothing; premium and background block advertising`,async()=>{
  const f=fixture(platform);const result=f.service.showRewardedAd();await tick();f.rewarded.emit('closed');assert.equal((await result).success,false);assert.equal(await f.service.getAdFreeMinutesRemaining(),0);
  f.appState.currentState='background';f.advance(600000);for(let i=0;i<8;i++)assert.equal(await f.service.onStationChange(),false);
  f.appState.currentState='active';f.premium();f.service.stationChangeCount=5;assert.equal(await f.service.showInterstitialAd(),false);assert.equal((await f.service.showRewardedAd()).success,false);
 });
}

test('another selection waits for the visible ad, preventing overlapping stream startup',async()=>{
 const f=fixture();f.advance(600000);f.service.firstStationAdShown=true;f.service.stationChangeCount=5;
 const first=f.service.showInterstitialAd();await tick();let done=false;const second=f.service.onStationChange().then(x=>{done=true;return x;});await tick();
 assert.equal(done,false);assert.equal(f.calls.filter(x=>x==='show').length,1);
 f.interstitial.emit('closed');assert.equal(await first,true);assert.equal(await second,false);
});

test('reward remains usable if local persistence fails, with no duplicate grant',async()=>{
 const f=fixture();f.failStorage();await f.service.grantAdFreeTime(30);
 assert.equal(await f.service.isAdFree(),true);assert.equal(await f.service.getAdFreeMinutesRemaining(),30);
 f.advance(1800000);assert.equal(await f.service.isAdFree(),false);assert.equal(await f.service.getAdFreeMinutesRemaining(),0);
});

test('remote configuration cannot increase pressure beyond shipped safeguards and can disable automatic ads', async () => {
  const { canShowStationAd, updateAutomaticAdPolicy } = await import('../../src/utils/adPolicy.ts');
  const input={now:600001,sessionStartedAt:0,lastFullScreenAt:0,stationChanges:5,automaticAdsThisSession:0,foreground:true,adFree:false,showing:false};
  updateAutomaticAdPolicy({enabled:true,minimumIntervalMs:1,stationChanges:1,maximumAutomaticAdsPerSession:99});
  assert.equal(canShowStationAd({...input,now:599999}),false);
  assert.equal(canShowStationAd({...input,stationChanges:4}),false);
  assert.equal(canShowStationAd({...input,automaticAdsThisSession:3}),false);
  assert.equal(canShowStationAd(input),true);
  updateAutomaticAdPolicy({enabled:false});
  assert.equal(canShowStationAd(input),false);
  updateAutomaticAdPolicy({enabled:true,minimumIntervalMs:NaN,stationChanges:NaN,maximumAutomaticAdsPerSession:NaN});
  assert.equal(canShowStationAd(input),true);
});

test('remote playback waits for a visible ad without counting a station change or requesting an ad',async()=>{
 const f=fixture();f.advance(600000);f.service.firstStationAdShown=true;f.service.stationChangeCount=5;
 const ad=f.service.showInterstitialAd();await tick();let continued=false;
 const remote=f.service.waitForPresentation().then(()=>{continued=true;});await tick();
 assert.equal(continued,false);assert.equal(f.calls.filter(x=>x==='show').length,1);
 f.interstitial.emit('closed');await ad;await remote;
 assert.equal(continued,true);assert.equal(f.service.stationChangeCount,0);
 await f.service.waitForPresentation();
 assert.equal(f.calls.filter(x=>x==='show').length,1);
});

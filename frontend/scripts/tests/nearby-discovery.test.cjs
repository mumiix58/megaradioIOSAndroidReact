const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console: { log() {}, error() {} }, require: id => { if (!(id in mocks)) throw Error(id); return mocks[id]; } });
  return module.exports;
}
const country = load('src/utils/countryScope.ts');
const { nearbyScope, shouldShowNearbyLocationPrompt } = load('src/utils/nearbyScope.ts', { './countryScope': country });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { resolve, promise }; };
function locationHarness(request, location = {}) {
  let state;
  const { useLocationStore } = load('src/store/locationStore.ts', {
    '../services/api': { get: request }, '../utils/countryScope': country,
    zustand: { create: init => { state = init(p => Object.assign(state, p), () => state); return { getState: () => state }; } },
    'expo-location': location, '@react-native-async-storage/async-storage': { getItem: async () => null },
  });
  return useLocationStore.getState();
}
(async () => {
  let n = 0;
  const test = async (name, run) => { await run(); console.log('PASS ' + name); n++; };
  await test('Country-only request enabled without GPS or invented distance', () => { const s = nearbyScope(null, null, 'Austria'); assert.equal(s.enabled, true); assert.equal(s.params.country, 'Austria'); assert.equal(s.params.lat, undefined); });
  await test('Coordinates use distance endpoint with country preference', () => { const s = nearbyScope(48.2082, 16.3738, 'Austria'); assert.equal(s.params.lat, 48.2082); assert.equal(s.params.country, undefined); assert.equal(s.params.userCountry, 'Austria'); });
  await test('Zero coordinates are valid', () => assert.equal(nearbyScope(0, 0).enabled, true));
  await test('Global without GPS stays disabled', () => { for (const c of [undefined, 'Global', 'all']) assert.equal(nearbyScope(null, null, c).enabled, false); });
  await test('Invalid or incomplete coordinates never sent', () => { for (const pair of [[NaN, 10], [91, 10], [45, 181], [null, 10]]) { const s = nearbyScope(...pair, 'Austria'); assert.equal(s.params.lat, undefined); assert.equal(s.params.country, 'Austria'); } });
  const response = { data: { location: { detected: true, country: 'Austria', countryCode: 'AT', lat: 48, lng: 16 } } };
  await test('IP country fills Austria without converting approximate IP into GPS', async () => { const s = locationHarness(async () => response); await s.detectCountryFromIp(); assert.equal(s.countryCode, 'AT'); assert.equal(s.countryEnglish, 'Austria'); assert.equal(s.country, 'Österreich'); assert.equal(s.latitude, null); });
  await test('Late IP result cannot overwrite manual selection', async () => { const d = deferred(), s = locationHarness(() => d.promise); const p = s.detectCountryFromIp(); Object.assign(s, { isManuallySet: true, countryEnglish: 'Turkey' }); d.resolve(response); await p; assert.equal(s.countryEnglish, 'Turkey'); assert.equal(s.nearbyCountryEnglish, 'Austria'); assert.equal(s.nearbyCountryCode, 'AT'); });
  await test('GPS result wins over late IP response', async () => { const d = deferred(), s = locationHarness(() => d.promise); const p = s.detectCountryFromIp(); Object.assign(s, { latitude: 41, longitude: 29, countryEnglish: 'Turkey' }); d.resolve(response); await p; assert.equal(s.countryEnglish, 'Turkey'); });
  await test('Germany IP remains independent of selected Turkey', async () => { const s = locationHarness(async () => ({ data: { location: { detected: true, country: 'Germany', countryCode: 'DE' } } })); Object.assign(s, { isManuallySet: true, countryEnglish: 'Turkey', countryCode: 'TR' }); await s.detectCountryFromIp(); assert.equal(s.countryEnglish, 'Turkey'); assert.equal(s.countryCode, 'TR'); assert.equal(s.nearbyCountryEnglish, 'Germany'); assert.equal(s.nearbyCountryCode, 'DE'); const scope = nearbyScope(s.latitude, s.longitude, s.nearbyCountryEnglish); assert.equal(scope.params.country, 'Germany'); });
  await test('GPS Germany country does not replace browsing Turkey', async () => { const s = locationHarness(async () => ({}), { getForegroundPermissionsAsync: async () => ({ status: 'granted' }), getCurrentPositionAsync: async () => ({ coords: { latitude: 52.52, longitude: 13.405 } }), reverseGeocodeAsync: async () => [{ country: 'Germany', isoCountryCode: 'DE' }], Accuracy: { Low: 1 } }); Object.assign(s, { isManuallySet: true, countryEnglish: 'Turkey', countryCode: 'TR' }); await s.fetchLocation(); assert.equal(s.countryCode, 'TR'); assert.equal(s.nearbyCountryCode, 'DE'); assert.equal(s.nearbyCountryEnglish, 'Germany'); assert.equal(s.latitude, 52.52); });
  await test('IP errors retain stored country', async () => { const s = locationHarness(async () => { throw Error('offline'); }); s.countryEnglish = 'Austria'; await s.detectCountryFromIp(); assert.equal(s.countryEnglish, 'Austria'); });
  await test('Undetected IP never resets country to Global', async () => { const s = locationHarness(async () => ({ data: { location: { detected: false, country: 'all' } } })); s.countryEnglish = 'Austria'; await s.detectCountryFromIp(); assert.equal(s.countryEnglish, 'Austria'); });
  await test('IP detection does not block stored-country startup', async () => { const d = deferred(), s = locationHarness(() => d.promise); await s.loadStoredCountry(); assert.equal(s.isLoaded, true); d.resolve(response); });
  await test('Startup never asks for an undetermined permission', async()=>{
    let prompts=0,gps=0;const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'undetermined',canAskAgain:true}),requestForegroundPermissionsAsync:async()=>{prompts++;return {status:'granted'};},getCurrentPositionAsync:async()=>{gps++;}});
    await s.fetchLocation();assert.equal(prompts,0);assert.equal(gps,0);assert.equal(s.permission,'undetermined');assert.equal(s.error,null);assert.equal(s.loading,false);
  });
  await test('Existing permission loads GPS silently and web geocoding failure does not discard it', async()=>{
    let prompts=0;const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'granted'}),requestForegroundPermissionsAsync:async()=>{prompts++;},getCurrentPositionAsync:async()=>({coords:{latitude:0,longitude:0}}),reverseGeocodeAsync:async()=>{throw Error('unsupported on web');},Accuracy:{Low:1}});
    await s.fetchLocation();assert.equal(prompts,0);assert.equal(s.permission,'granted');assert.equal(s.latitude,0);assert.equal(s.longitude,0);assert.equal(s.error,null);assert.equal(s.loading,false);
  });
  await test('Only explicit action may request permission', async()=>{
    let prompts=0;const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'undetermined',canAskAgain:true}),requestForegroundPermissionsAsync:async()=>{prompts++;return {status:'granted'};},getCurrentPositionAsync:async()=>({coords:{latitude:48,longitude:16}}),reverseGeocodeAsync:async()=>[],Accuracy:{Low:1}});
    await s.fetchLocation({requestPermission:true});assert.equal(prompts,1);assert.equal(s.latitude,48);assert.equal(s.error,null);
  });
  await test('Blocked permission never re-prompts and revoked coordinates are cleared', async()=>{
    let prompts=0;const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'denied',canAskAgain:false}),requestForegroundPermissionsAsync:async()=>{prompts++;}});
    Object.assign(s,{latitude:48,longitude:16});await s.fetchLocation({requestPermission:true});assert.equal(prompts,0);assert.equal(s.latitude,null);assert.equal(s.longitude,null);assert.equal(s.permission,'denied');assert.equal(s.canAskAgain,false);assert.equal(s.error,null);
  });
  await test('Permission denial keeps country discovery usable', async()=>{
    const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'undetermined'}),requestForegroundPermissionsAsync:async()=>({status:'denied',canAskAgain:true})});
    Object.assign(s,{countryEnglish:'Austria',nearbyCountryEnglish:'Austria'});await s.fetchLocation({requestPermission:true});assert.equal(s.permission,'denied');assert.equal(s.countryEnglish,'Austria');assert.equal(nearbyScope(s.latitude,s.longitude,s.nearbyCountryEnglish).enabled,true);
  });
  await test('GPS failure is distinct from permission denial', async()=>{
    const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'granted'}),getCurrentPositionAsync:async()=>{throw Error('timeout');},Accuracy:{Low:1}});await s.fetchLocation();assert.equal(s.permission,'granted');assert.equal(s.error,'Failed to get location');assert.equal(s.loading,false);
  });
  await test('Disabled location services do not trigger a permission request', async()=>{
    let gps=0;const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:async()=>({status:'granted'}),hasServicesEnabledAsync:async()=>false,getCurrentPositionAsync:async()=>{gps++;}});await s.fetchLocation();assert.equal(gps,0);assert.equal(s.error,'services-disabled');assert.equal(s.permission,'granted');
  });
  await test('Concurrent location requests cannot duplicate a system prompt', async()=>{
    let prompts=0;const d=deferred();const s=locationHarness(async()=>({}),{getForegroundPermissionsAsync:()=>d.promise,requestForegroundPermissionsAsync:async()=>{prompts++;return {status:'denied'};}});const first=s.fetchLocation({requestPermission:true});await s.fetchLocation({requestPermission:true});d.resolve({status:'undetermined'});await first;assert.equal(prompts,1);
  });
  await test('Location CTA disappears as soon as permission is granted, even without GPS',()=>{
    assert.equal(shouldShowNearbyLocationPrompt('granted',null,null),false);
    assert.equal(shouldShowNearbyLocationPrompt('granted',48.2,16.3),false);
    assert.equal(shouldShowNearbyLocationPrompt('undetermined',null,null),true);
    assert.equal(shouldShowNearbyLocationPrompt('denied',null,null),true);
    assert.equal(shouldShowNearbyLocationPrompt('unknown',48.2,16.3),false);
    assert.equal(shouldShowNearbyLocationPrompt('undetermined',null,null,true),false);
    assert.equal(shouldShowNearbyLocationPrompt('denied',NaN,16),true);
  });
  console.log(`PASS ${n} nearby discovery cases`);
})().catch(e => { console.error(e); process.exitCode = 1; });

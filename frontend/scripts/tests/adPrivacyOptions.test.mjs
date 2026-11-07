import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { prepareAdConsent } from '../../src/utils/adConsent.ts';
import { AD_POLICY, canShowStationAd } from '../../src/utils/adPolicy.ts';

function fixture() {
  let finishForm;
  const events = [];
  let permitted = false;
  const consent = {
    getConsentInfo: async () => ({ canRequestAds: permitted, privacyOptionsRequirementStatus: 'REQUIRED' }),
    requestInfoUpdate: async () => { events.push('check-current-consent'); return { canRequestAds: permitted }; },
    loadAndShowConsentFormIfRequired: async () => ({ canRequestAds: permitted }),
    showPrivacyOptionsForm: () => new Promise(resolve => { events.push('open-options'); finishForm = resolve; }),
  };
  const mobileAds = { default: () => ({ setRequestConfiguration: async () => {}, initialize: async () => { events.push('initialize-sdk'); } }), AdsConsent: consent, MaxAdContentRating: { T: 'T' }, AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' } };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../../src/services/adMobService.native.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, {
    exports, console: { log() {}, error() {} }, setTimeout() {}, clearTimeout() {}, __DEV__: true,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' }, NativeModules: {} };
      if (name === '@react-native-async-storage/async-storage') return { setItem: async () => {} };
      if (name === '../utils/adConsent') return { prepareAdConsent };
      if (name === '../utils/adPolicy') return { AD_POLICY, canShowStationAd };
      if (name === 'react-native-google-mobile-ads') return mobileAds;
      throw Error(name);
    },
  });
  const service = exports.adMobService;
  service.isInitialized = true;
  for (const key of ['interstitialAd', 'rewardedAd', 'appOpenAd']) service[key] = { removeAllListeners() { events.push('discard-' + key); } };
  return { service, events, finish() { finishForm({ canRequestAds: permitted }); } };
}

test('privacy choices discard cached ads and prevent initialization while the form is open', async () => {
  const f = fixture();
  assert.equal(await f.service.requiresPrivacyOptions(), true);
  const changing = f.service.showPrivacyOptions();
  assert.equal(f.service.isInitialized, false);
  assert.equal(await f.service.initialize(), false);
  await f.service.showPrivacyOptions(); // no second form on a duplicate press
  assert.deepEqual(f.events, ['discard-interstitialAd', 'discard-rewardedAd', 'discard-appOpenAd', 'open-options']);
  f.finish(); await changing;
  assert.equal(f.service.isInitialized, false);
  assert.equal(f.events.filter(x => x === 'open-options').length, 1);
  assert.ok(f.events.includes('check-current-consent'));
  assert.ok(!f.events.includes('initialize-sdk'));
  assert.equal(f.service.isInterstitialAdReady(), false);
});

test('two requests waiting for initialization still present only one privacy form', async () => {
  const f = fixture();
  let initialized;
  f.service.initializationPromise = new Promise(resolve => { initialized = resolve; });
  const first = f.service.showPrivacyOptions();
  const second = f.service.showPrivacyOptions();
  f.service.initializationPromise = null;
  initialized(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.events.filter(x => x === 'open-options').length, 1);
  f.finish();
  await Promise.all([first, second]);
});

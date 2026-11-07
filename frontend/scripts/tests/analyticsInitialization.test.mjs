import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { analyticsLanguage, searchMetrics } from '../../src/utils/analyticsMetrics.ts';

function fixture({ clearId = async () => {}, failObserverOnce = false } = {}) {
  const calls = [];
  let observers = 0;
  const sdk = {
    async setUserId(value) { calls.push(['clear-start', value]); await clearId(); calls.push(['clear-finished', value]); },
    async setAnalyticsCollectionEnabled(value) { calls.push(['enabled', value]); },
    async logScreenView(value) { calls.push(['screen', value]); },
    async logEvent(name, value) { calls.push([name, value]); },
    async logAppOpen() { calls.push(['app-open']); },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../../src/services/analyticsService.native.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports, console: { log() {}, warn() {} },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-constants') return { expoConfig: { version: '1.0.70', android: { versionCode: 100 } } };
      if (name === 'expo-device') return { deviceType: 1, DeviceType: { PHONE: 1, TABLET: 2, TV: 3, DESKTOP: 4 } };
      if (name === '@react-native-firebase/analytics') return { default: () => sdk };
      if (name.endsWith('/analyticsMetrics')) return { analyticsLanguage, searchMetrics };
      if (name.endsWith('/languageStore')) return { useLanguageStore: { getState: () => ({ currentLanguage: 'de' }) } };
      if (name === './analyticsObservers') return { observeMobileAnalytics(sink) {
        observers++;
        if (failObserverOnce && observers === 1) throw Error('transient setup failure');
        calls.push(['observers']);
        void sink.logDiagnosticEvent('observer_ready', {});
      } };
      throw Error(name);
    },
  });
  return { service: exports.analyticsService, calls, get observers() { return observers; } };
}

test('route effects and custom events wait for legacy ID clearing even before root initialization', async () => {
  let resolve;
  const gate = new Promise(done => { resolve = done; });
  const f = fixture({ clearId: () => gate });
  const work = [f.service.logScreenView('home'), f.service.logDiagnosticEvent('sample', {}), f.service.initialize(), f.service.initialize(), f.service.logScreenView('home')];
  await Promise.resolve();
  assert.deepEqual(f.calls, [['clear-start', null]]);
  resolve(); await Promise.all(work);
  await new Promise(done => setImmediate(done));
  assert.equal(f.calls.filter(([name]) => name === 'clear-start').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'screen').length, 1);
  assert.equal(f.observers, 1);
  assert.ok(f.calls.findIndex(([name]) => name === 'clear-finished') < f.calls.findIndex(([name]) => name === 'screen'));
  const event = f.calls.find(([name]) => name === 'sample')[1];
  assert.equal(event.form_factor, 'phone');
  assert.equal(event.app_language, 'de');
  assert.equal(event.app_build, '100');
});

test('a failed identifier clear emits no event and initialization can safely retry', async () => {
  let attempt = 0;
  const f = fixture({ clearId: async () => { if (++attempt === 1) throw Error('native not ready'); } });
  await f.service.initialize();
  assert.equal(f.observers, 0);
  assert.ok(!f.calls.some(([name]) => name === 'enabled'));
  await f.service.initialize();
  assert.equal(f.observers, 1);
  assert.equal(attempt, 2);
});

test('observer setup failure remains retryable without reenabling analytics or reclearing ID', async () => {
  const f = fixture({ failObserverOnce: true });
  await f.service.initialize();
  await f.service.initialize();
  await f.service.initialize();
  assert.equal(f.observers, 2);
  assert.equal(f.calls.filter(([name]) => name === 'enabled').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'clear-start').length, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture({ reject = false, dev = false } = {}) {
  const calls = [];
  const sdk = Object.fromEntries(['log','recordError','setUserId','setAttribute','setAttributes','crash','setCrashlyticsCollectionEnabled'].map(name => [name, (...args) => {
    calls.push([name, ...args]);
    return reject ? Promise.reject(Error('bridge unavailable')) : Promise.resolve();
  }]));
  const original = (...args) => calls.push(['original', ...args]);
  let handler = original;
  let installs = 0;
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../../src/services/crashlyticsService.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, console: { warn() {} }, __DEV__: dev,
    ErrorUtils: { getGlobalHandler: () => handler, setGlobalHandler: value => { installs++; handler = value; } },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === '@react-native-firebase/crashlytics') return { default: () => sdk };
      throw Error(name);
    },
  });
  return { service: exports.crashlyticsService, calls, fire: (...args) => handler(...args), installs: () => installs };
}

test('concurrent initialization enables collection once', async () => {
  const f = fixture(); await Promise.all([f.service.initialize(), f.service.initialize(), f.service.initialize()]);
  assert.equal(f.calls.filter(([name]) => name === 'setCrashlyticsCollectionEnabled').length, 1);
});

test('global errors delegate once without duplicate non-fatal reporting after repeated setup', async () => {
  const f = fixture(); f.service.setupGlobalErrorHandler(); f.service.setupGlobalErrorHandler();
  const error = Error('fatal playback exception'); f.fire(error, true);
  assert.equal(f.installs(), 1);
  assert.equal(f.calls.filter(([name]) => name === 'original').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'recordError').length, 0);
  assert.equal(f.calls.find(([name]) => name === 'original')[1], error);
});

test('rejected native reporting calls do not escape as unhandled rejections', async () => {
  const f = fixture({ reject: true });
  f.service.recordError(Error('stream failed'), 'player'); f.service.log('transition');
  f.service.setUserId(''); f.service.setAttribute('screen', 'player'); f.service.setAttributes({ state: 'paused' });
  await f.service.initialize();
  await new Promise(resolve => setImmediate(resolve));
});

test('test crash is disabled in release builds', () => {
  const f = fixture(); f.service.testCrash(); assert.ok(!f.calls.some(([name]) => name === 'crash'));
  const dev = fixture({ dev: true }); dev.service.testCrash(); assert.ok(dev.calls.some(([name]) => name === 'crash'));
});

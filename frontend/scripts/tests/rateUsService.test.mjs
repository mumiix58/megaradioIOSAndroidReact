import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../../src/services/rateUsService.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function fixture(os = 'ios', persisted = new Map()) {
  let now = Math.max(1_800_000_000_000, Number(persisted.get('@rateus/last_requested')) || 0);
  let state = { currentStation: { _id: 'station-1' }, playbackState: 'idle' };
  const playerListeners = new Set();
  const appListeners = new Set();
  const requests = [];
  const links = [];
  let available = true;
  const appState = {
    currentState: 'active',
    addEventListener(_event, cb) {
      appListeners.add(cb);
      return { remove: () => appListeners.delete(cb) };
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    Date: { now: () => now },
    require(name) {
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async key => persisted.get(key) ?? null,
        setItem: async (key, value) => { persisted.set(key, value); },
        multiRemove: async keys => { keys.forEach(key => persisted.delete(key)); },
      };
      if (name === 'react-native') return { Platform: { OS: os }, AppState: appState, Linking: { openURL: async url => links.push(url) } };
      if (name === 'expo-store-review') return { isAvailableAsync: async () => available, requestReview: async () => requests.push(now) };
      if (name === '../store/playerStore') return { usePlayerStore: {
        getState: () => state,
        subscribe(cb) { playerListeners.add(cb); return () => playerListeners.delete(cb); },
      } };
      throw new Error(name);
    },
  });
  const service = exports.rateUsService;
  const pending = [];
  const unsubscribe = service.onShouldShow(() => { pending.push(service.requestReviewIfEligible()); });
  const f = {
    service, persisted, requests, links,
    tick(ms) { now += ms; },
    setPlayback(playbackState, stationId = state.currentStation._id) {
      const previous = state;
      state = { currentStation: { _id: stationId }, playbackState };
      playerListeners.forEach(cb => cb(state, previous));
    },
    setAppState(value) { appState.currentState = value; appListeners.forEach(cb => cb(value)); },
    async flush() { await new Promise(resolve => setImmediate(resolve)); await Promise.all(pending); },
    async launch(count = 1) { for (let i = 0; i < count; i++) await service.trackAppLaunch(); },
    async session(ms = 120_000) { f.setPlayback('playing'); f.tick(ms); f.setPlayback('paused'); await f.flush(); },
    setAvailable(value) { available = value; },
    stop: unsubscribe,
    observerCount() { return playerListeners.size + appListeners.size; },
  };
  return f;
}

test('launches and failed play intents never trigger a prompt; three meaningful sessions do', async () => {
  const f = fixture();
  await f.launch(3);
  for (let i = 0; i < 10; i++) await f.service.trackStationPlay();
  assert.equal(f.requests.length, 0);
  await f.session(119_999);
  f.setPlayback('loading'); f.tick(500_000); f.setPlayback('error');
  await f.session(); await f.session();
  assert.equal(f.requests.length, 0);
  await f.session();
  assert.equal(f.requests.length, 1);
  assert.equal(f.persisted.has('@rateus/rated'), false);
  assert.equal(f.links.length, 0);
});

test('engagement needs both repeated launches and completed listening, not one or the other', async () => {
  const f = fixture();
  await f.launch();
  await f.session(); await f.session(); await f.session();
  assert.equal(f.requests.length, 0);
  await f.launch(2);
  assert.equal(f.requests.length, 0);
  await f.session();
  assert.equal(f.requests.length, 1);
});

test('background, buffering, errors and a station change cannot fabricate listening time', async () => {
  const f = fixture();
  await f.launch(3);
  f.setPlayback('playing'); f.tick(30_000);
  f.setAppState('background'); f.tick(900_000); f.setAppState('active');
  f.tick(30_000); f.setPlayback('buffering'); f.tick(900_000);
  f.setPlayback('playing'); f.tick(30_000); f.setPlayback('paused');
  await f.flush();
  assert.equal(f.persisted.has('@rateus/completed_listening_sessions'), false);
  f.setPlayback('playing'); f.tick(120_000); f.setPlayback('error'); f.setPlayback('paused');
  await f.flush();
  assert.equal(f.persisted.has('@rateus/completed_listening_sessions'), false);
  f.setPlayback('playing'); f.tick(120_000); f.setPlayback('playing', 'station-2');
  f.tick(1_000); f.setPlayback('paused'); await f.flush();
  assert.equal(f.persisted.has('@rateus/completed_listening_sessions'), false);
});

test('attempt cooldown survives restarts and prevents duplicate concurrent native requests', async () => {
  const f = fixture();
  await f.launch(3);
  await f.session(); await f.session(); await f.session();
  await Promise.all([f.service.requestReviewIfEligible(), f.service.requestReviewIfEligible()]);
  assert.equal(f.requests.length, 1);
  const restarted = fixture('ios', f.persisted);
  await restarted.session();
  assert.equal(restarted.requests.length, 0);
  restarted.tick(120 * 86_400_000);
  await restarted.session();
  assert.equal(restarted.requests.length, 1);
});

test('background pause does not prompt and resuming the app is never a prompt trigger', async () => {
  const f = fixture();
  await f.launch(3);
  await f.session(); await f.session();
  f.setPlayback('playing'); f.tick(120_000);
  f.setAppState('background'); f.setPlayback('paused'); await f.flush();
  assert.equal(f.requests.length, 0);
  f.setAppState('active'); await f.flush();
  assert.equal(f.requests.length, 0);
});

test('missing native review support stays silent; manual profile entry opens the exact store', async () => {
  const f = fixture();
  f.setAvailable(false);
  await f.launch(3);
  await f.session(); await f.session(); await f.session();
  assert.equal(f.requests.length, 0);
  assert.equal(f.links.length, 0);
  await f.service.openStoreReview();
  assert.deepEqual(f.links, ['https://apps.apple.com/app/id6759302561?action=write-review']);
  assert.equal(f.persisted.has('@rateus/rated'), false);
  const android = fixture('android');
  await android.service.openStoreReview();
  assert.deepEqual(android.links, ['https://play.google.com/store/apps/details?id=com.megaradio']);
});

test('legacy recent prompts preserve cooldown, while an unverified legacy rated flag is not treated as proof', async () => {
  const f = fixture('ios', new Map([['@rateus/rated', '1'], ['@rateus/last_shown', '1800000000000']]));
  await f.launch(3);
  await f.session(); await f.session(); await f.session();
  assert.equal(f.requests.length, 0);
  f.tick(120 * 86_400_000);
  await f.session();
  assert.equal(f.requests.length, 1);
});

test('unmount removes playback and AppState observers; web never registers native observers', async () => {
  const f = fixture();
  assert.equal(f.observerCount(), 2);
  f.stop();
  assert.equal(f.observerCount(), 0);
  const web = fixture('web');
  await web.launch(3); await web.session();
  assert.equal(web.observerCount(), 0);
  assert.equal(web.requests.length, 0);
});

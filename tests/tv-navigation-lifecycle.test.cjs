const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const ts = require(path.join(base, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(base, 'src/hooks/useTVNavigation.ts'), 'utf8');

function mountedNavigation() {
  let effect, observer, nextId = 0, scans = 0;
  const timeouts = new Map(), intervals = new Map(), listeners = new Map();
  const document = {
    body: { contains: () => true },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const window = { platformInfo: {}, tvSpatialNav: {
    focusedElement: {}, focusableElements: [{}],
    updateFocusableElements: () => scans++, init: () => {}, handleMouseOver: () => {},
  } };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module, exports: module.exports, document, window,
    require: id => { assert.equal(id, 'react'); return { useEffect: fn => { effect = fn; } }; },
    MutationObserver: class { constructor(fn) { observer = this; this.callback = fn; } observe() {} disconnect() { this.disconnected = true; } },
    setTimeout: fn => { const id = ++nextId; timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
  });
  module.exports.useTVNavigation();
  const cleanup = effect();
  return { cleanup, observer, timeouts, intervals, listeners, scans: () => scans,
    flush: () => { const queued = Array.from(timeouts.values()); timeouts.clear(); queued.forEach(fn => fn()); } };
}

test('DOM mutation bursts schedule one navigation refresh while the page is mounted', () => {
  const page = mountedNavigation();
  for (let i = 0; i < 100; i++) page.observer.callback();
  assert.equal(page.timeouts.size, 1);
  page.flush();
  assert.equal(page.scans(), 1);
  page.cleanup();
});

test('leaving a route cancels pending focus scans and ignores an already queued callback', () => {
  const page = mountedNavigation();
  page.observer.callback();
  const queuedCallback = Array.from(page.timeouts.values())[0];
  page.cleanup();
  assert.equal(page.timeouts.size, 0);
  assert.equal(page.intervals.size, 0);
  assert.equal(page.listeners.size, 0);
  assert.equal(page.observer.disconnected, true);
  queuedCallback();
  page.observer.callback();
  page.flush();
  assert.equal(page.scans(), 0);
});

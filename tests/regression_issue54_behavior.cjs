const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/node_modules/typescript'));

let assertionCount = 0;
const check = (condition, message) => {
  assertionCount += 1;
  assert.ok(condition, message);
};

function createStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function resolveTsFile(specifier, parentFile) {
  if (specifier.startsWith('@/')) {
    const base = path.join(path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src'), specifier.slice(2));
    return resolveWithExtensions(base);
  }
  if (specifier.startsWith('.')) {
    const base = path.resolve(path.dirname(parentFile), specifier);
    return resolveWithExtensions(base);
  }
  return null;
}

function resolveWithExtensions(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Cannot resolve module: ${base}`);
}

function compileTs(source, filename) {
  return ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    },
  }).outputText;
}

function makeRunner({ stubs = {}, sourceMutators = {}, globals = {} } = {}) {
  const cache = new Map();

  const load = (entryFile) => {
    const resolved = path.resolve(entryFile);
    if (cache.has(resolved)) return cache.get(resolved).exports;

    let source = fs.readFileSync(resolved, 'utf8');
    if (typeof sourceMutators[resolved] === 'function') {
      source = sourceMutators[resolved](source);
    }
    const compiled = compileTs(source, resolved);

    const module = { exports: {} };
    const sandbox = {
      module,
      exports: module.exports,
      __filename: resolved,
      __dirname: path.dirname(resolved),
      console,
      process,
      globalThis: null,
      ...globals,
    };
    sandbox.global = sandbox;
    sandbox.globalThis = sandbox;

    const localRequire = (specifier) => {
      if (Object.prototype.hasOwnProperty.call(stubs, specifier)) {
        return stubs[specifier];
      }
      const tsFile = resolveTsFile(specifier, resolved);
      if (tsFile) return load(tsFile);
      return require(specifier);
    };

    sandbox.require = localRequire;
    cache.set(resolved, module);
    vm.runInNewContext(compiled, sandbox, { filename: resolved });
    return module.exports;
  };

  return { load };
}

function createReactStubs(capture) {
  return {
    react: {
      createContext: (initial) => {
        const ctx = { _value: initial };
        ctx.Provider = ({ value, children }) => {
          ctx._value = value;
          return children ?? null;
        };
        return ctx;
      },
      useContext: (ctx) => ctx?._value,
      useState: (initial) => {
        let value = typeof initial === 'function' ? initial() : initial;
        const setValue = (next) => {
          value = typeof next === 'function' ? next(value) : next;
        };
        return [value, setValue];
      },
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        const cleanup = fn();
        if (typeof cleanup === 'function') capture.cleanups.push(cleanup);
      },
      useRef: (initial) => ({ current: initial }),
    },
    jsxRuntime: {
      jsx: (type, props) => {
        if (typeof type === 'function') return type(props || {});
        return { type, props: props || {} };
      },
      jsxs: (type, props) => {
        if (typeof type === 'function') return type(props || {});
        return { type, props: props || {} };
      },
      Fragment: Symbol('Fragment'),
    },
  };
}

async function testNormalizeCompanionCountries() {
  const runner = makeRunner();
  const mod = runner.load(path.join(ROOT, 'frontend/src/utils/companionCountries.ts'));
  const normalize = mod.normalizeCompanionCountries;

  const mixed = normalize([
    'Turkey',
    ' turkey ',
    null,
    { name: 'Germany', code: 'DE', flag: '🇩🇪', stationCount: 12 },
    { country: 'United Kingdom', countryCode: 'GB', stationCount: 3 },
    { name: 'Germany', iso_3166_1: 'DEU' },
    { name: 'NoCodeLand' },
  ]);

  check(Array.isArray(mixed), 'normalize should return array');
  check(mixed.length === 4, 'normalize should dedupe and skip invalid entries');
  check(mixed[0].name === 'Turkey' && mixed[0].code === 'Turkey', 'raw string should keep name as code');
  check(mixed[1].name === 'Germany' && mixed[1].code === 'DE', 'explicit code should be preserved');
  check(mixed[2].name === 'United Kingdom' && mixed[2].code === 'GB', 'countryCode should map to code');
  check(mixed.every((c) => typeof c.flag === 'string' && typeof c.stationCount === 'number'), 'flag/stationCount required fields');

  const envelope = normalize({ countries: [{ country: 'France', countrycode: 'FR', stationCount: 5 }] });
  check(envelope.length === 1 && envelope[0].code === 'FR', 'envelope countries should normalize');

  const emptyNull = normalize(null);
  check(Array.isArray(emptyNull) && emptyNull.length === 0, 'null payload should return []');
}

async function testStreamRouting() {
  let platform = 'web';
  const globals = {
    window: { location: { protocol: 'https:' } },
    URL,
  };
  const runner = makeRunner({
    stubs: {
      './platform': { detectPlatform: () => platform },
    },
    globals,
  });
  const mod = runner.load(path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/lib/streamRouting.ts'));

  platform = 'web';
  globals.window.location.protocol = 'https:';
  check(mod.usesPreviewStreamRoutes() === false, 'production web must not use preview routes');
  globals.window.location.hostname = 'qa.preview.emergentagent.com';
  check(mod.usesPreviewStreamRoutes() === true, 'actual Emergent preview uses preview routes');

  globals.window.location.protocol = 'http:';
  check(mod.usesPreviewStreamRoutes() === true, 'web + http should use preview routes');

  globals.window.location.protocol = 'file:';
  check(mod.usesPreviewStreamRoutes() === false, 'web + file should not use preview routes');

  for (const p of ['electron', 'androidtv', 'tizen', 'webos']) {
    platform = p;
    globals.window.location.protocol = 'https:';
    check(mod.usesPreviewStreamRoutes() === false, `${p} should not use preview routes`);
  }

  const src = 'https://radio.example/path/list.pls';
  const pls = '[playlist]\nFile1=http://streams.example/live';
  check(mod.parseStationPlaylist(pls, src) === 'http://streams.example/live', 'PLS absolute URL parse failed');

  const relative = '#EXTM3U\n/live-radio';
  check(mod.parseStationPlaylist(relative, src) === 'https://radio.example/live-radio', 'relative playlist URL should resolve');

  const hlsManifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10,segment\nseg.ts';
  check(mod.parseStationPlaylist(hlsManifest, src) === src, 'HLS manifest should preserve source URL');

  check(mod.parseStationPlaylist('<html>login</html>', src) === src, 'HTML payload should fallback to source URL');
  check(mod.parseStationPlaylist('ftp://bad.example/stream', src) === src, 'ftp scheme should be rejected');
}

async function testPaywallProviderBehavior() {
  const capture = { paywallProps: null, alerts: [], cleanups: [] };
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const calls = [];
  const windowObj = {
    location: { hash: '#/' },
    megaRadioNative: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    CustomEvent,
  };

  const reactStubs = createReactStubs(capture);

  const runner = makeRunner({
    stubs: {
      react: reactStubs.react,
      'react/jsx-runtime': reactStubs.jsxRuntime,
      '@/hooks/usePremium': {
        usePremium: () => ({
          isPremium: false,
          adsRemoved: false,
          ready: true,
          applyVerified: () => {},
        }),
      },
      '@/components/PremiumPaywall': {
        PremiumPaywall: (props) => {
          capture.paywallProps = props;
          return null;
        },
      },
    },
    globals: {
      window: windowObj,
      localStorage,
      sessionStorage,
      alert: (msg) => capture.alerts.push(String(msg)),
      setTimeout: () => 1,
      clearTimeout: () => {},
      CustomEvent,
    },
  });

  const mod = runner.load(path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/contexts/PaywallContext.tsx'));
  mod.PaywallProvider({ children: null });
  check(capture.paywallProps && typeof capture.paywallProps.onPurchase === 'function', 'onPurchase callback not captured');

  const onPurchase = capture.paywallProps.onPurchase;

  // 1) Missing native support routes to upgrade and does not purchase.
  capture.alerts.length = 0;
  windowObj.megaRadioNative = { supportsNativeIap: false };
  localStorage.setItem('tv_auth_token', 'tok-a');
  await onPurchase('megaradio_premium_yearly');
  check(windowObj.location.hash === '#/premium-upgrade', 'missing native support should route to premium-upgrade');

  // 2) Missing token prevents purchase/restore.
  let setAuthCalled = false;
  windowObj.megaRadioNative = {
    supportsNativeIap: true,
    setAuthToken: async () => {
      setAuthCalled = true;
    },
    purchase: async () => ({ ok: true }),
  };
  localStorage.removeItem('tv_auth_token');
  capture.alerts.length = 0;
  await onPurchase('megaradio_premium_yearly');
  check(capture.alerts.some((m) => m.includes('Please sign in')), 'missing auth token should alert sign-in');
  check(setAuthCalled === false, 'setAuthToken must not be called without token');

  // 3) Purchase false result alerts failure and preserves auth/token call args.
  calls.length = 0;
  capture.alerts.length = 0;
  localStorage.setItem('tv_auth_token', 'tok-purchase');
  windowObj.megaRadioNative = {
    supportsNativeIap: true,
    setAuthToken: async (t) => calls.push(`set:${t}`),
    purchase: async (productId, token) => {
      calls.push(`buy:${productId}:${token}`);
      return { ok: false, message: 'Purchase rejected' };
    },
  };
  await onPurchase('megaradio_premium_yearly');
  check(calls[0] === 'set:tok-purchase', 'setAuthToken must run before purchase call');
  check(calls[1] === 'buy:megaradio_premium_yearly:tok-purchase', 'purchase args should include productId and token');
  check(capture.alerts.some((m) => m.includes('Purchase rejected')), 'failed purchase should alert rejection');
  check(!capture.alerts.some((m) => /requested|completed/i.test(m)), 'failed purchase must not alert success text');

  // 4) Restore false result alerts failure and uses restore API with token.
  calls.length = 0;
  capture.alerts.length = 0;
  localStorage.setItem('tv_auth_token', 'tok-restore');
  windowObj.megaRadioNative = {
    supportsNativeIap: true,
    setAuthToken: async (t) => calls.push(`set:${t}`),
    restorePurchases: async (token) => {
      calls.push(`restore:${token}`);
      return { ok: false, message: 'Restore failed' };
    },
  };
  await onPurchase('restore');
  check(calls[0] === 'set:tok-restore' && calls[1] === 'restore:tok-restore', 'restore should receive same auth token');
  check(capture.alerts.some((m) => m.includes('Restore failed')), 'failed restore should alert failure');
  check(!capture.alerts.some((m) => /requested|loaded/i.test(m)), 'failed restore must not alert success text');

  // 5) Token change while setAuthToken awaited aborts purchase.
  let purchaseCalled = false;
  localStorage.setItem('tv_auth_token', 'tok-start');
  capture.alerts.length = 0;
  windowObj.megaRadioNative = {
    supportsNativeIap: true,
    setAuthToken: async () => {
      localStorage.setItem('tv_auth_token', 'tok-changed');
    },
    purchase: async () => {
      purchaseCalled = true;
      return { ok: true };
    },
  };
  await onPurchase('megaradio_premium_monthly1');
  check(purchaseCalled === false, 'purchase must abort when auth token changes during setAuthToken');
}

async function testGlobalPlayerRoutingFunctions() {
  const file = path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/contexts/GlobalPlayerContext.tsx');
  const nowPlayingFile = path.join(ROOT, 'frontend/tvanddesktop/apple-tv-and-macos/web-preview/src/hooks/useNowPlayingMetadata.ts');
  const sourceMutators = {
    [file]: (src) => `${src
      .replace(/\(import\.meta as any\)\.env\?\.VITE_METADATA_WS/g, 'undefined')
    }\n\nexport const __issue54_test_exports = { getProxiedUrl, resolveStreamUrl, resolvePlaylistOnTV };\n`,
    [nowPlayingFile]: (src) => src.replace(/\(import\.meta as any\)\.env\?\.VITE_METADATA_WS/g, 'undefined'),
  };

  let previewRoutes = true;
  const fetchCalls = [];
  let timeoutCalls = 0;
  let clearTimeoutCalls = 0;

  const runner = makeRunner({
    sourceMutators,
    stubs: {
      react: createReactStubs({ cleanups: [] }).react,
      'react/jsx-runtime': createReactStubs({ cleanups: [] }).jsxRuntime,
      '@radiolise/metadata-client': { createMetadataClient: () => ({ subscribe: () => ({ unsubscribe: () => {} }), trackStream: async () => {}, terminate: () => {} }) },
      '@/services/megaRadioApi': { megaRadioApi: {}, Station: function Station() {} },
      '@/services/recentlyPlayedService': { recentlyPlayedService: { addStation: () => {}, syncFromApi: () => {} } },
      '@/services/recommendationService': { recommendationService: { trackListen: () => {} } },
      '@/lib/analytics': { trackStationPlay: () => {}, trackError: () => {} },
      '@/contexts/AuthContext': { useAuth: () => ({ isAuthenticated: false, token: '' }) },
      '@/lib/streamRouting': {
        browserStreamUrl: (url, force = false) => previewRoutes && (force || url.startsWith('http://')) ? '/api/stream-proxy?url=' + encodeURIComponent(url) : url,
        streamResolveEndpoint: url => '/api/stream-resolve?url=' + encodeURIComponent(url),
        resolvedStreamResponse: (data, original) => ({ resolvedUrl: data.final_url || original, isPlaylist: data.isPlaylist, isHLS: data.isHLS }),
        isBrowserAutoplayBlock: () => false,
        parseStationPlaylist: (text, sourceUrl) => {
          const line = text.split(/\r?\n/).find((l) => l.includes('http'));
          return line ? line.trim() : sourceUrl;
        },
      },
    },
    globals: {
      window: { location: { protocol: 'https:' } },
      localStorage: createStorage(),
      AbortController,
      fetch: async (url, opts = {}) => {
        fetchCalls.push(String(url));
        if (String(url).startsWith('/api/stream-resolve')) {
          return {
            ok: true,
            json: async () => ({ final_url: 'https://resolver.example/playlist.pls', isPlaylist: true, isHLS: false }),
          };
        }
        return {
          ok: true,
          url: 'https://resolver.example/playlist.pls',
          text: async () => 'https://direct.example/live',
        };
      },
      setTimeout: (fn) => {
        timeoutCalls += 1;
        return { fn, id: timeoutCalls };
      },
      clearTimeout: () => {
        clearTimeoutCalls += 1;
      },
      URL,
      navigator: {},
    },
  });

  const mod = runner.load(file);
  const hooks = mod.__issue54_test_exports;
  check(hooks && typeof hooks.getProxiedUrl === 'function', 'failed to expose GlobalPlayer helper exports');

  // Preview browser should proxy mixed-content http streams.
  previewRoutes = true;
  const proxied = hooks.getProxiedUrl('http://radio.example/live');
  check(proxied.startsWith('/api/stream-proxy?url='), 'preview http stream should use /api/stream-proxy');

  // Packaged environments must not route via /api helpers.
  previewRoutes = false;
  const packaged = hooks.getProxiedUrl('http://radio.example/live');
  check(packaged === 'http://radio.example/live', 'packaged runtime should not use /api stream-proxy');

  // resolveStreamUrl should honor final_url and resolve playlists through preview proxy.
  previewRoutes = true;
  fetchCalls.length = 0;
  timeoutCalls = 0;
  clearTimeoutCalls = 0;
  const resolved = await hooks.resolveStreamUrl('https://input.example/source.m3u');
  check(resolved.resolvedUrl === 'https://direct.example/live', 'resolveStreamUrl should follow final_url playlist resolution');
  check(fetchCalls[0].startsWith('/api/stream-resolve?url='), 'resolveStreamUrl should call /api/stream-resolve');
  check(fetchCalls[1].startsWith('/api/stream-proxy?url='), 'preview playlist resolve should use /api/stream-proxy');
  check(timeoutCalls >= 2 && clearTimeoutCalls >= 2, 'resolve helpers should set and clear abort timers');

  // resolvePlaylistOnTV in packaged mode should fetch original URL (never /api).
  previewRoutes = false;
  fetchCalls.length = 0;
  const packagedDirect = await hooks.resolvePlaylistOnTV('https://pkg.example/list.pls', false);
  check(fetchCalls[0] === 'https://pkg.example/list.pls', 'packaged playlist resolve must fetch direct URL, not /api');
  check(packagedDirect === 'https://direct.example/live', 'packaged playlist parser should return direct stream entry');
}

async function run() {
  await testNormalizeCompanionCountries();
  await testStreamRouting();
  await testPaywallProviderBehavior();
  await testGlobalPlayerRoutingFunctions();
  console.log(`PASS regression_issue54_behavior (${assertionCount} assertions)`);
}

run().catch((err) => {
  console.error('FAIL regression_issue54_behavior:', err && err.stack ? err.stack : err);
  process.exit(1);
});

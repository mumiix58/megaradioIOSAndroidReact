const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../frontend');
const ts = require(path.join(root, 'node_modules/typescript'));

function load(file, modules) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const context = { exports: {},__DEV__:false, console: { log() {}, warn() {}, error() {} }, require(name) {
    if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(output, context);
  return context.exports;
}
const backendUser = { _id: 'user-1', email: 'fixture@example.invalid', fullName: 'Fixture User', username: 'fixture', role: 'user' };
function auth(post) {
  return load('src/services/authService.ts', {
    './api': { post }, '../constants/api': { API_ENDPOINTS: { auth: {} } },
    '../store/authStore': { useAuthStore: { getState: () => ({ deviceInfo: { deviceType: 'tablet', deviceName: 'iPad' } }) } },
  });
}

test('email login preserves HTTP errors so a rejected password is not reported as a network failure', async () => {
  const failure = { response: { status: 401, data: { error: 'Invalid email or password' } } };
  const module = auth(async () => { throw failure; });
  await assert.rejects(module.authService.mobileLogin('a@b.test', 'wrong'), error => error === failure);
  assert.equal(module.authErrorMessage(failure, 'fallback'), 'Invalid email or password');
});

test('registration normalizes email and returns a valid mobile session on iPad', async () => {
  for (const email of [' A@Example.invalid ', `${'a'.repeat(65)}@example.invalid`]) {
    const requests = [];
    const { authService } = auth(async (url, data) => {
      requests.push({ url, data });
      return { data: url.endsWith('/signup') ? { user: backendUser } : { token: 'fixture-token', user: backendUser } };
    });
    const result = await authService.mobileRegister(email, 'long-password', ' Fixture User ');
    assert.equal(result.success, true);
    assert.equal(result.user._id, 'user-1');
    assert.equal(result.user.id, 'user-1');
    assert.equal(result.user.name, 'Fixture User');
    assert.equal(requests[0].data.email, email.trim().toLowerCase());
    assert.match(requests[0].data.username, /^[a-z0-9_]{3,30}$/);
    assert.equal(requests[1].data.deviceType, 'mobile');
    assert.equal(requests[1].data.deviceName, 'iPad');
  }
});

test('social responses retain identity/profile fields and accept token responses without a success flag', async () => {
  const { authService } = auth(async () => ({ data: { token: 'fixture-token', user: backendUser } }));
  for (const result of [await authService.googleSignIn('google-fixture'), await authService.appleSignIn('apple-fixture', '', null, null, 'subject')]) {
    assert.equal(result.success, true);
    assert.equal(result.user._id, 'user-1');
    assert.equal(result.user.username, 'fixture');
    assert.equal(result.user.name, 'Fixture User');
  }
});

test('malformed or explicitly failed sessions are never accepted', async () => {
  for (const data of [{ user: backendUser }, { token: 'fixture-token' }, { success: false, token: 'fixture-token', user: backendUser }]) {
    await assert.rejects(auth(async () => ({ data })).authService.mobileLogin('a@b.test', 'password'));
  }
});

function social({ result, appleCredential, backendError } = {}) {
  const calls = { configure: 0, tokens: 0, backend: 0, signOut: 0 };
  const response = { success: true, token: 'fixture-token', user: backendUser };
  const backend = async () => { calls.backend++; if (backendError) throw backendError; return response; };
  const module = load('src/services/socialAuthService.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-apple-authentication': { isAvailableAsync: async () => true, signInAsync: async () => appleCredential, AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } },
    './authService': { __esModule: true, default: { googleSignIn: backend, appleSignIn: backend }, authErrorMessage: (e, fallback) => e.response?.data?.error || e.message || fallback },
    '@react-native-google-signin/google-signin': { statusCodes: {}, GoogleSignin: {
      signOut: async () => { calls.signOut++; },
      configure: () => calls.configure++, hasPlayServices: async () => true,
      signIn: async () => result,
      getTokens: async () => { calls.tokens++; return { idToken: 'PREVIOUS_ACCOUNT_TOKEN' }; },
    } },
  });
  return { service: module.socialAuthService, calls };
}

test('SDK v16 cancellation never signs in a previously cached Google account', async () => {
  const { service, calls } = social({ result: { type: 'cancelled', data: null } });
  assert.equal((await service.signInWithGoogle()).error, 'Authentication cancelled');
  assert.equal(calls.configure, 1);
  assert.equal(calls.tokens, 0);
  assert.equal(calls.backend, 0);
});

test('Google configures itself when opened directly and retains the full authenticated user', async () => {
  const { service, calls } = social({ result: { type: 'success', data: { idToken: 'fixture', user: { id: 'google-subject' } } } });
  assert.equal((await service.signInWithGoogle()).user._id, 'user-1');
  await service.signInWithGoogle();
  assert.equal(calls.configure, 1);
});

test('repeat Apple login works when Apple no longer supplies the name and email', async () => {
  const { service } = social({ appleCredential: { identityToken: 'fixture', authorizationCode: 'code', user: 'apple-subject', email: null, fullName: null } });
  const result = await service.signInWithApple();
  assert.equal(result.success, true);
  assert.equal(result.user._id, 'user-1');
});

test('provider verification failures expose the backend error instead of an Axios status message', async () => {
  const { service } = social({ result: { type: 'success', data: { idToken: 'fixture' } }, backendError: { message: 'Request failed with status code 401', response: { data: { error: 'Invalid or expired Google token' } } } });
  assert.equal((await service.signInWithGoogle()).error, 'Invalid or expired Google token');
});


test('app logout clears Google SDK identity without revoking consent', async () => {
  const { service, calls } = social();
  await service.signOutGoogle();
  assert.equal(calls.signOut, 1);
});

function authStore(failWrites = false) {
  const storage = new Map(); let state;
  const favorites = {setState() {}, getState: () => ({loadFavorites: async () => {}})};
  const module = load('src/store/authStore.ts', {
    zustand: {create: initializer => {
      const set = patch => {state = {...state, ...patch};};
      state = initializer(set, () => state);
      return {getState: () => state};
    }},
    'react-native': {Platform: {OS: 'ios'}},
    'expo-secure-store': {getItemAsync: async k => storage.get(k) || null,
      setItemAsync: async (k,v) => {if(failWrites)throw Error('fixture keychain failure');storage.set(k,v);},
      deleteItemAsync: async k => {storage.delete(k);}},
    '../services/queryClient':{queryClient:{cancelQueries:async()=>{},clear(){}}},'../services/sessionRuntime': {invalidateSession(){},sessionVersion:()=>0,isCurrentSession:()=>true},'../services/socialAuthService': {socialAuthService: {signOutGoogle: async () => {}}},
    '../services/flowaliveService': {flowaliveService: {setUser: async () => {}, clearUser: async () => {},trackUserLogout() {}}},
    './premiumStore':{usePremiumStore:{getState:()=>({reset(){},loadPremiumStatus:async()=>{}})}},'./songHistoryStore':{useSongHistoryStore:{setState(){}}},'./recentlyPlayedStore':{useRecentlyPlayedStore:{setState(){}}},'./favoritesStore': {useFavoritesStore: favorites},
    '../services/iapService': {iapService: {syncSubscriptionFromBackend: async () => {}}},
    '../services/pushNotificationService': {__esModule: true, default: {getStoredPushToken: async () => null}},
    '@react-native-async-storage/async-storage': {__esModule: true, default: {getItem: async () => null, multiRemove:async()=>{},removeItem: async () => {}}},
  });
  return {store: module.useAuthStore, storage};
}

test('secure storage failure never creates a successful in-memory login', async () => {
  const {store, storage} = authStore(true);
  await assert.rejects(store.getState().saveAuth(backendUser, 'fixture-token'));
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().token, null);
  assert.equal(storage.size, 0);
});

test('persisted login restores, logout removes both keys and remains loaded', async () => {
  const {store, storage} = authStore();
  await store.getState().saveAuth(backendUser, 'fixture-token');
  assert.equal(store.getState().isAuthLoaded, true);
  store.getState().clearAuth();
  await store.getState().loadStoredAuth();
  assert.equal(store.getState().user._id, backendUser._id);
  await store.getState().logout();
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().isAuthLoaded, true);
  assert.equal(storage.size, 0);
});


test('rapid Google taps cannot launch two SDK flows', async () => {
  let release;
  const result = new Promise(resolve => {release = resolve;});
  const {service,calls} = social({result});
  const first = service.signInWithGoogle();
  assert.equal((await service.signInWithGoogle()).error, 'Sign-in already in progress');
  release({type:'success',data:{idToken:'fixture',user:{id:'subject'}}});
  assert.equal((await first).success,true);
  assert.equal(calls.backend,1);
});

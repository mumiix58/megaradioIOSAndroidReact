import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// API_BASE strategy:
//   - On the Emergent web preview (browser hits api.themegaradio.com → CORS blocked)
//     we route through the local backend's tv-proxy at /api/tv-proxy/* by using
//     a base of "" (relative URLs). prepare-tizen.js / prepare-webos.js will
//     rewrite all /api/* to https://api.themegaradio.com/api/* at build time for
//     the .wgt / .ipk packages where CORS doesn't apply (file:// origin).
//   - On the .wgt / .ipk runtime, fetch hits the rewritten absolute URL directly.
// Net effect: ONE source-of-truth URL, two transport mechanisms, zero CORS pain.
function detectApiBase(): string {
  try {
    var host = window.location.hostname;
    // Tizen / WebOS apps run from file:// so hostname is empty/blank.
    // Also catch direct themegaradio.com hosting (if ever served from there).
    if (!host || host === '' || host === 'localhost' || host.indexOf('themegaradio.com') !== -1) {
      return 'https://api.themegaradio.com';
    }
  } catch (e) { /* ignore */ }
  // Preview / dev / hosted via Emergent ingress → use relative paths so the
  // /api/tv-proxy/* backend route handles CORS server-side.
  return '';
}

// Preview hits go through /api/tv-proxy/<path>. The .wgt/.ipk hits go directly
// to https://api.themegaradio.com/api/<path>. Same source code, different runtime.
function buildAuthUrl(path: string): string {
  var base = detectApiBase();
  if (base === '') {
    // Preview: insert /tv-proxy/ between /api/ and the rest.
    return '/api/tv-proxy' + path.replace(/^\/api/, '');
  }
  return base + path;
}

var API_BASE = detectApiBase();

function getAuthDeviceId(): string {
  try {
    var w = window as any;
    if (w.webapis && w.webapis.productinfo && typeof w.webapis.productinfo.getDuid === 'function') {
      return w.webapis.productinfo.getDuid();
    }
  } catch (e) {}
  try {
    var w2 = window as any;
    if (w2.webOS && w2.webOS.deviceInfo) {
      if (typeof w2.webOS.deviceInfo === 'object' && w2.webOS.deviceInfo.serialNumber) {
        return w2.webOS.deviceInfo.serialNumber;
      }
    }
  } catch (e) {}
  try {
    var saved = localStorage.getItem('tv_device_id');
    if (saved) return saved;
  } catch (e) {}
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  try { localStorage.setItem('tv_device_id', uuid); } catch (e) {}
  return uuid;
}

function getAuthPlatformName(): string {
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
  if (ua.indexOf('tizen') !== -1) return 'tizen';
  if (ua.indexOf('webos') !== -1) return 'webos';
  return 'other';
}

function getAuthDeviceName(): string {
  var platform = getAuthPlatformName();
  if (platform === 'tizen') return 'Samsung TV';
  if (platform === 'webos') return 'LG TV';
  return 'TV';
}

function fixAvatarUrl(user: any): any {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  // The TV API returns displayName; old caches and other account APIs use name/fullName.
  // Normalize once at the boundary so every authenticated screen receives a safe name.
  var names = [user.name, user.displayName, user.fullName, user.username];
  var name = names.find(function(value) { return typeof value === 'string' && value.trim().length > 0; });
  var normalized = { ...user, name: name ? name.trim() : 'Listener' };
  var identity = [user.id, user._id].find(function(value) { return typeof value === 'string' && value.trim().length > 0; });
  if (identity) normalized.id = identity;
  if (typeof normalized.avatar === 'string' && normalized.avatar && normalized.avatar.indexOf('http') !== 0) {
    normalized.avatar = 'https://themegaradio.com/' + normalized.avatar;
  }
  if (typeof normalized.profileImage === 'string' && normalized.profileImage && normalized.profileImage.indexOf('http') !== 0) {
    normalized.profileImage = 'https://themegaradio.com/' + normalized.profileImage;
  }
  return normalized;
}

interface UserSubscription {
  tier: 'free' | 'premium';
  plan?: 'monthly' | 'annual';
  validUntil?: string;
}

interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  subscription?: UserSubscription;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: () => void;
  /**
   * Authenticate the TV using a server-issued bearer token (no credentials
   * typed on the device). Used by the subscription Account-Linking flow:
   * after the user pays in the browser, the backend returns the same JWT
   * via `GET /api/subscription/tv/code/:code/status` → we feed it here.
   */
  loginWithToken: (token: string, user: User) => void;
  logout: () => void;
  deviceCode: string | null;
  codeExpiresAt: string | null;
  isPolling: boolean;
  loginError: boolean;
}

var AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  var [user, setUser] = useState<User | null>(null);
  var [token, setToken] = useState<string | null>(null);
  var [isLoading, setIsLoading] = useState(true);
  var [deviceCode, setDeviceCode] = useState<string | null>(null);
  var [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  var [isPolling, setIsPolling] = useState(false);
  var [loginError, setLoginError] = useState(false);
  var pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  var codeExpiresAtRef = useRef<string | null>(null);

  useEffect(function() {
    codeExpiresAtRef.current = codeExpiresAt;
  }, [codeExpiresAt]);

  var isAuthenticated = !!token && !!user;

  // Keep the Android TV receipt validator's session current, including logout.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mr:auth-changed'));
    const desktop = (window as any).megaRadioNative;
    if (desktop?.setAuthToken) void desktop.setAuthToken(token || null).catch(() => {});
    if (typeof window === 'undefined' || !(window as any).MegaRadioNative?.invoke) return;
    import('@/lib/nativeIap').then(({ nativeIap }) => nativeIap.setAuthToken(token))
      .catch(error => console.warn('[Auth] Native billing session sync failed'));
  }, [token]);

  useEffect(function() {
    var savedToken = null;
    try {
      savedToken = localStorage.getItem('tv_auth_token');
    } catch (e) {
      // localStorage not available
    }

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    verifyToken(savedToken);
  }, []);

  function verifyToken(savedToken: string) {
    fetch(API_BASE + '/api/auth/tv/verify', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + savedToken }
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Token invalid');
      }
      return response.json();
    })
    .then(function(data) {
      setToken(savedToken);
      var savedUser = null;
      try {
        var raw = localStorage.getItem('tv_auth_user');
        if (raw) {
          savedUser = JSON.parse(raw);
        }
      } catch (e) {
        // parse error
      }
      if (savedUser) {
        setUser(fixAvatarUrl(savedUser));
      } else if (data && data.user) {
        setUser(fixAvatarUrl(data.user));
      }
      setIsLoading(false);
    })
    .catch(function() {
      try {
        localStorage.removeItem('tv_auth_token');
        localStorage.removeItem('tv_auth_user');
      } catch (e) {
        // ignore
      }
      setToken(null);
      setUser(null);
      setIsLoading(false);
    });
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }

  function login() {
    stopPolling();
    setDeviceCode(null);
    setCodeExpiresAt(null);
    setLoginError(false);

    fetch(buildAuthUrl('/api/auth/tv/code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getAuthDeviceId(),
        deviceName: getAuthDeviceName(),
        platform: getAuthPlatformName()
      })
    })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Failed to get device code');
      }
      return response.json();
    })
    .then(function(data) {
      console.log('[Auth] Code request ready:', typeof data.code === 'string' && data.code.length > 0);
      var code = data.code;
      // CLOCK-SAFE: always derive the deadline from THIS device's clock + the
      // relative TTL. Smart TVs (Tizen/WebOS) frequently have a wrong system
      // clock; comparing the server's ABSOLUTE expiresAt against the TV's
      // Date.now() then makes the code look "expired" instantly. Using
      // Date.now() + expiresIn keeps both sides on the same (TV) clock.
      var ttlSec = Number(data.expiresIn) || 600;
      var expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
      setDeviceCode(code);
      setCodeExpiresAt(expiresAt);
      setLoginError(false);
      startPolling(code);
    })
    .catch(function(err) {
      console.error('[Auth] Device-code request failed');
      setLoginError(true);
    });
  }

  function startPolling(code: string) {
    setIsPolling(true);

    pollingRef.current = setInterval(function() {
      var expiresStr = codeExpiresAtRef.current;
      if (expiresStr) {
        var expiresTime = new Date(expiresStr).getTime();
        if (Date.now() >= expiresTime) {
          console.log('[Auth] Device code expired, requesting new code');
          stopPolling();
          login();
          return;
        }
      }

      var currentDeviceId = getAuthDeviceId();
      var statusUrl = buildAuthUrl('/api/auth/tv/code/' + code + '/status') + '?deviceId=' + encodeURIComponent(currentDeviceId);
      fetch(statusUrl, {
        method: 'GET'
      })
      .then(function(response) {
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            console.log('[Auth] Code expired/invalid on server, requesting new code');
            stopPolling();
            login();
            return;
          }
          throw new Error('Polling failed: ' + response.status);
        }
        return response.json();
      })
      .then(function(data) {
        if (!data) return;
        console.log('[Auth] Poll status:', data.status === 'activated' ? 'activated' : data.expired ? 'expired' : 'pending');
        if (data.expired || data.status === 'expired') {
          console.log('[Auth] Server reported code expired, requesting new code');
          stopPolling();
          login();
          return;
        }
        var isActivated = data.activated || data.status === 'activated' || data.status === 'verified';
        if (isActivated && data.token) {
          var newToken = data.token;
          var newUser = fixAvatarUrl(data.user);

          try {
            localStorage.setItem('tv_auth_token', newToken);
            localStorage.setItem('tv_auth_user', JSON.stringify(newUser));
          } catch (e) {
            // localStorage error
          }

          setToken(newToken);
          setUser(newUser);
          setDeviceCode(null);
          setCodeExpiresAt(null);
          stopPolling();
        }
      })
      .catch(function(err) {
        console.warn('[Auth] Polling request failed');
      });
    }, 3000);
  }

  /**
   * Programmatically sign the user in using a server-issued token+user blob
   * (used by the subscription flow — after Stripe completes, the backend
   * returns the same JWT shape our login flow uses).
   */
  function loginWithToken(newToken: string, newUser: User) {
    try {
      localStorage.setItem('tv_auth_token', newToken);
      localStorage.setItem('tv_auth_user', JSON.stringify(newUser));
    } catch (e) { /* localStorage error */ }
    stopPolling();
    setToken(newToken);
    setUser(fixAvatarUrl(newUser));
    setDeviceCode(null);
    setCodeExpiresAt(null);
    setLoginError(false);
  }

  function logout() {
    var currentToken = token;
    stopPolling();

    if (currentToken) {
      fetch(buildAuthUrl('/api/auth/tv/logout'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + currentToken }
      }).catch(function() {
        // ignore logout API errors
      });
    }

    try {
      localStorage.removeItem('tv_auth_token');
      localStorage.removeItem('tv_auth_user');
    } catch (e) {
      // ignore
    }

    setToken(null);
    setUser(null);
    setDeviceCode(null);
    setCodeExpiresAt(null);
  }

  useEffect(function() {
    return function() {
      stopPolling();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: isAuthenticated,
        user: user,
        token: token,
        isLoading: isLoading,
        login: login,
        loginWithToken: loginWithToken,
        logout: logout,
        deviceCode: deviceCode,
        codeExpiresAt: codeExpiresAt,
        isPolling: isPolling,
        loginError: loginError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  var context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { User } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateSession, isCurrentSession, sessionVersion } from '../services/sessionRuntime';
import { queryClient } from '../services/queryClient';

const TOKEN_KEY = 'megaradio_auth_token';
const USER_KEY = 'megaradio_user_data';

interface AuthState {
  // User data
  user: User | null;
  
  // Authentication token (mobile)
  token: string | null;
  
  // Authentication status
  isAuthenticated: boolean;
  
  // Auth loaded from storage flag
  isAuthLoaded: boolean;
  
  // Loading state
  isLoading: boolean;
  
  // Error message
  error: string | null;
  
  // Device info
  deviceInfo: {
    deviceType: 'mobile' | 'tablet' | 'tv';
    deviceName: string;
  };
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Auth operations
  loadStoredAuth: () => Promise<void>;
  saveAuth: (user: User, token: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  clearAuth: () => void;
  expireSession: (expectedToken: string) => Promise<void>;
  revalidateSession: () => Promise<void>;
}

// Secure storage helpers (cross-platform)
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Web fallback - use localStorage
      return localStorage.getItem(key);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

const getDeviceInfo = () => {
  // Basic device detection
  let deviceType: 'mobile' | 'tablet' | 'tv' = 'mobile';
  let deviceName = 'Unknown Device';
  
  if (Platform.OS === 'ios') {
    deviceName = 'iPhone';
    deviceType = 'mobile';
  } else if (Platform.OS === 'android') {
    deviceName = 'Android Device';
    deviceType = 'mobile';
  } else if (Platform.OS === 'web') {
    // Safe check for navigator (SSR compatibility)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    deviceName = userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser';
    deviceType = userAgent.includes('Mobile') ? 'mobile' : 'tablet';
  }
  
  return { deviceType, deviceName };
};

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isAuthLoaded: false,  // Track if auth was loaded from storage
  isLoading: true,
  error: null,
  deviceInfo: getDeviceInfo(),
};

let authWrites: Promise<void> = Promise.resolve();
function persist(operation: () => Promise<void>) {
  authWrites = authWrites.catch(() => {}).then(operation);
  return authWrites;
}
function resetPrivateMemory() {
  invalidateSession();
  void queryClient.cancelQueries();
  queryClient.clear();
  require('./premiumStore').usePremiumStore.getState().reset();
  require('./songHistoryStore').useSongHistoryStore.setState({ entries: [], loaded: false });
  require('./favoritesStore').useFavoritesStore.setState({ favorites: [], customOrder: [], isLoaded: false, isLoading: false, error: null });
  require('./recentlyPlayedStore').useRecentlyPlayedStore.setState({ stations: [], loaded: false, isLoading: false });
}
async function clearLegacyData() {
  await AsyncStorage.multiRemove([
    '@megaradio_favorites', '@megaradio_favorites_order', '@megaradio_favorites_sync_queue',
    'megaradio_recently_played', 'megaradio_premium_status', 'megaradio_android_auto_favorites',
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  setUser: user => set({ user, isAuthenticated: user !== null, error: null }),
  setToken: token => set({ token }),
  setAuthenticated: isAuthenticated => set({ isAuthenticated }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),

  loadStoredAuth: async () => {
    const version = sessionVersion();
    try {
      const [token, storedUser] = await Promise.all([secureStorage.getItem(TOKEN_KEY), secureStorage.getItem(USER_KEY)]);
      if (!isCurrentSession(version)) return;
      if (token && storedUser) {
        set({ token, user: JSON.parse(storedUser), isAuthenticated: true, isAuthLoaded: true, isLoading: false });
        await require('./premiumStore').usePremiumStore.getState().loadPremiumStatus();
        await get().revalidateSession();
      } else set({ isAuthLoaded: true, isLoading: false });
    } catch {
      if (isCurrentSession(version)) set({ isAuthLoaded: true, isLoading: false });
    }
    void import('../services/authRevocationService').then(service => service.revokeSession()).catch(() => {});
  },

  revalidateSession: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const { default: authService } = await import('../services/authService');
      const result = await authService.mobileCheckAuth();
      if (get().token !== token) return;
      if (!result.authenticated) await get().expireSession(token);
      else if (result.user) await get().updateUser({ ...get().user!, ...result.user });
    } catch { /* An unavailable service is not an invalid session. */ }
  },

  saveAuth: async (user, token) => {
    resetPrivateMemory();
    const version = sessionVersion();
    set({ user: null, token: null, isAuthenticated: false });
    await persist(async () => {
      await clearLegacyData();
      await Promise.all([secureStorage.setItem(TOKEN_KEY, token), secureStorage.setItem(USER_KEY, JSON.stringify(user))]);
    });
    if (!isCurrentSession(version)) return;
    set({ user, token, isAuthenticated: true, isAuthLoaded: true, isLoading: false, error: null });
    await require('./premiumStore').usePremiumStore.getState().loadPremiumStatus();
    if (!isCurrentSession(version)) return;
    const { useFavoritesStore } = await import('./favoritesStore');
    await useFavoritesStore.getState().loadFavorites();
    if (!isCurrentSession(version)) return;
    try {
      const { iapService } = await import('../services/iapService');
      await iapService.syncSubscriptionFromBackend();
    } catch { /* Keep only this account's previously verified offline entitlement. */ }
  },

  updateUser: async user => {
    const token = get().token;
    if (!token || user._id !== get().user?._id) return;
    await persist(() => secureStorage.setItem(USER_KEY, JSON.stringify(user)));
    if (get().token === token) set({ user });
  },

  logout: async () => {
    const token = get().token;
    // Stop old async results immediately; cleanup requests explicitly use the old token.
    resetPrivateMemory();
    set({ ...initialState, isAuthLoaded: true, isLoading: false });
    await persist(async () => {
      await Promise.all([secureStorage.removeItem(TOKEN_KEY), secureStorage.removeItem(USER_KEY)]);
      await clearLegacyData();
    });
    if (token) {
      try {
        const push = (await import('../services/pushNotificationService')).default;
        const pushToken = await push.getStoredPushToken();
        if (pushToken) await push.deletePushTokenFromBackend(pushToken, token);
      } catch { /* Revocation still runs when push cleanup is unavailable. */ }
      await import('../services/authRevocationService').then(service => service.revokeSession(token)).catch(() => {});
    }
  },

  expireSession: async expectedToken => {
    if (get().token !== expectedToken) return;
    await get().logout();
  },
  clearAuth: () => { void get().logout(); },
}));
export default useAuthStore;

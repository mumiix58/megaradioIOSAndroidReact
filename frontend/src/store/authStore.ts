import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { User } from '../types';

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
      throw error;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null,
      error: null,
    }),

  setToken: (token) =>
    set({ token }),

  setAuthenticated: (isAuthenticated) =>
    set({ isAuthenticated }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setError: (error) =>
    set({ error }),

  // Load stored auth on app startup
  loadStoredAuth: async () => {
    set({ isLoading: true });
    
    try {
      console.log('[AuthStore] Loading stored auth...');
      const [storedToken, storedUser] = await Promise.all([
        secureStorage.getItem(TOKEN_KEY),
        secureStorage.getItem(USER_KEY),
      ]);
      
      console.log('[AuthStore] Token found:', !!storedToken);
      console.log('[AuthStore] User found:', !!storedUser);
      
      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser) as User;
        set({
          token: storedToken,
          user,
          isAuthenticated: true,
          isAuthLoaded: true,
          isLoading: false,
        });
        console.log('[AuthStore] Auth restored successfully');
      } else {
        set({ isLoading: false, isAuthLoaded: true });
        console.log('[AuthStore] No stored auth found');
      }
    } catch (error) {
      console.error('[AuthStore] Error loading stored auth:', error);
      set({ isLoading: false, isAuthLoaded: true });
    }
  },

  // Save auth after successful login
  saveAuth: async (user: User, token: string) => {
    try {
      // Wait for BOTH writes before cleanup: one rejected write must not race
      // a still-running write that could restore half a session afterwards.
      const writes = await Promise.allSettled([
        secureStorage.setItem(TOKEN_KEY, token),
        secureStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
      const failed = writes.find((write) => write.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      
      set({
        user,
        token,
        isAuthenticated: true,
        isAuthLoaded: true,
        error: null,
      });
      
      // Set FlowAlive user identity
      try {
        const { flowaliveService } = await import('../services/flowaliveService');
        await flowaliveService.setUser(user);
      } catch (e) {
        console.log('[AuthStore] FlowAlive setUser error:', e);
      }
      
      // Load favorites from server after login - NO DELAY to avoid "no favorites" flash
      // Import dynamically to avoid circular dependency
      // Immediately load favorites from server (no setTimeout!)
      console.log('[AuthStore] Login successful, loading favorites from server...');
      try {
        const { useFavoritesStore } = await import('./favoritesStore');
        await useFavoritesStore.getState().loadFavorites();
        console.log('[AuthStore] Favorites loaded after login');
      } catch (error) {
        console.error('[AuthStore] Failed to load favorites:', error);
      }

      // GÖREV 2: Sync subscription from backend after login
      if (Platform.OS !== 'web') {
        try {
          const { iapService } = await import('../services/iapService');
          await iapService.syncSubscriptionFromBackend();
          console.log('[AuthStore] Backend subscription synced after login');
        } catch (syncError) {
          console.warn('[AuthStore] Subscription sync after login failed:', syncError);
        }
      }
    } catch (error) {
      console.error('Error saving auth:', error);
      await Promise.allSettled([secureStorage.removeItem(TOKEN_KEY), secureStorage.removeItem(USER_KEY)]);
      set({user: null, token: null, isAuthenticated: false, isAuthLoaded: true});
      throw error;
    }
  },

  // Update user data (e.g., after avatar upload)
  updateUser: async (user: User) => {
    try {
      await secureStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    } catch (error) {
      console.error('Error updating user:', error);
    }
  },

  // Logout - clear everything
  logout: async () => {
    try {
      const currentUser = get().user;
      // Reset the native provider session as well, so the next login can choose
      // another account instead of silently reusing the previous SDK identity.
      try {
        const {socialAuthService} = await import('../services/socialAuthService');
        await socialAuthService.signOutGoogle();
      } catch { /* local logout must still succeed without Google services */ }

      
      // Delete push token from backend FIRST (while we still have auth token)
      if (Platform.OS !== 'web') {
        try {
          const pushNotificationService = (await import('../services/pushNotificationService')).default;
          const pushToken = await pushNotificationService.getStoredPushToken();
          if (pushToken) {
            console.log('[AuthStore] Deleting push token from backend...');
            await pushNotificationService.deletePushTokenFromBackend(pushToken);
          }
        } catch (e) {
          console.log('[AuthStore] Failed to delete push token:', e);
        }
      }
      
      // Clear FlowAlive user identity
      try {
        const { flowaliveService } = await import('../services/flowaliveService');
        await flowaliveService.clearUser();
        flowaliveService.trackUserLogout();
      } catch (e) {
        console.log('[AuthStore] FlowAlive clearUser error:', e);
      }
      
      // BEFORE clearing: backup favorites keyed by user ID so they survive logout/re-login
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      if (currentUser?._id) {
        try {
          const currentFavJson = await AsyncStorage.default.getItem('@megaradio_favorites');
          if (currentFavJson) {
            const parsed = JSON.parse(currentFavJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await AsyncStorage.default.setItem(
                `@megaradio_favorites_backup_${currentUser._id}`,
                currentFavJson
              );
              console.log('[AuthStore] Backed up', parsed.length, 'favorites for user', currentUser._id);
            }
          }
        } catch (e) {
          console.log('[AuthStore] Failed to backup favorites:', e);
        }
      }
      
      await Promise.all([
        secureStorage.removeItem(TOKEN_KEY),
        secureStorage.removeItem(USER_KEY),
      ]);
      
      // Clear active favorites on logout to ensure clean state for new users
      await Promise.all([
        AsyncStorage.default.removeItem('@megaradio_favorites'),
        AsyncStorage.default.removeItem('@megaradio_favorites_order'),
        AsyncStorage.default.removeItem('@megaradio_push_token'),
      ]);
      
      // Reset favorites store state
      const { useFavoritesStore } = await import('./favoritesStore');
      useFavoritesStore.setState({ favorites: [], customOrder: [], isLoaded: false });
      
      console.log('[AuthStore] Logout complete - favorites backed up and cleared');
    } catch (error) {
      console.error('Error clearing auth storage:', error);
    }
    
    set({
      ...initialState,
      isAuthLoaded: true,
      isLoading: false,
      deviceInfo: get().deviceInfo,
    });
  },

  // Clear auth state (without storage)
  clearAuth: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));

export default useAuthStore;

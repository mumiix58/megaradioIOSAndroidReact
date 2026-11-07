import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';
import { isCurrentSession, sessionVersion } from '../services/sessionRuntime';

export type PremiumPlan = 'none' | 'remove_ads' | 'premium_monthly' | 'premium_yearly' | 'premium_lifetime';
export type PremiumFeature = 'remove_ads' | 'song_info' | 'spotify_link' | 'youtube_link' | 'hd_stream' | 'song_history' | 'stream_record';
export interface Entitlement { plan: PremiumPlan; expiryDate: string | null; isActive: boolean; features: PremiumFeature[]; }
const PLANS = ['none', 'remove_ads', 'premium_monthly', 'premium_yearly', 'premium_lifetime'];
const FEATURES = ['remove_ads', 'song_info', 'spotify_link', 'youtube_link', 'hd_stream', 'song_history', 'stream_record'];
const key = (userId: string) => `megaradio_verified_premium_v2:${userId}`;
// Offline access is bounded and only uses a previously verified account entitlement.
const MAX_OFFLINE_AGE = 24 * 60 * 60 * 1000;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const empty = { isPremium: false, isRemoveAds: false, plan: 'none' as PremiumPlan, expiryDate: null, features: [] as PremiumFeature[], ownerId: null as string | null, verifiedAt: 0, loaded: true };

export function parseEntitlement(data: any): Entitlement {
  if (!data || !PLANS.includes(data.plan) || typeof data.isActive !== 'boolean' || !Array.isArray(data.features)) {
    throw new Error('Invalid subscription response');
  }
  const expiryDate = data.expiryDate || null;
  if (data.isActive && data.plan !== 'none' && data.plan !== 'premium_lifetime' && (!expiryDate || !Number.isFinite(Date.parse(expiryDate)))) {
    throw new Error('Subscription expiry is missing');
  }
  const active = data.isActive && data.plan !== 'none' && (data.plan === 'premium_lifetime' || Date.parse(expiryDate) > Date.now());
  return { plan: active ? data.plan : 'none', expiryDate: active ? expiryDate : null, isActive: active,
    features: active ? data.features.filter((f: string) => FEATURES.includes(f)) : [] };
}

interface PremiumState {
  isPremium: boolean; isRemoveAds: boolean; plan: PremiumPlan; expiryDate: string | null;
  features: PremiumFeature[]; ownerId: string | null; verifiedAt: number; loaded: boolean;
  loadPremiumStatus: () => Promise<void>;
  applyEntitlement: (data: unknown, userId: string) => Promise<void>;
  clearPremium: (userId?: string) => Promise<void>;
  reset: () => void;
  hasFeature: (feature: PremiumFeature) => boolean;
}

function currentOwner() { return useAuthStore.getState().user?._id || null; }
function stateFor(data: Entitlement, userId: string, verifiedAt: number) {
  return { plan: data.plan, expiryDate: data.expiryDate, features: data.features, ownerId: userId, verifiedAt, loaded: true,
    isPremium: data.isActive && data.plan !== 'remove_ads', isRemoveAds: data.isActive && data.features.includes('remove_ads') };
}

export const usePremiumStore = create<PremiumState>((set, get) => ({
  ...empty,
  reset: () => { clearTimeout(expiryTimer); set({ ...empty }); },
  loadPremiumStatus: async () => {
    const userId = currentOwner(); const version = sessionVersion();
    if (get().ownerId !== userId) { clearTimeout(expiryTimer); set({ ...empty }); }
    // Old local-only purchases cannot establish an account entitlement.
    await AsyncStorage.removeItem('megaradio_premium_status');
    if (!userId) return;
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      if (!isCurrentSession(version) || currentOwner() !== userId || !raw) return;
      const cached = JSON.parse(raw);
      if (cached.ownerId !== userId || !Number.isFinite(cached.verifiedAt) || Date.now() - cached.verifiedAt > MAX_OFFLINE_AGE || cached.verifiedAt > Date.now()) return;
      if (get().verifiedAt > cached.verifiedAt) return;
      const data = parseEntitlement(cached);
      set(stateFor(data, userId, cached.verifiedAt));
      scheduleExpiry(data, userId, cached.verifiedAt);
    } catch { /* Server sync can recover an absent or corrupt cache. */ }
  },
  applyEntitlement: async (response, userId) => {
    if (currentOwner() !== userId) return;
    const data = parseEntitlement(response);
    const verifiedAt = Date.now();
    set(stateFor(data, userId, verifiedAt));
    scheduleExpiry(data, userId, verifiedAt);
    await AsyncStorage.setItem(key(userId), JSON.stringify({ ...data, ownerId: userId, verifiedAt }));
  },
  clearPremium: async (userId) => {
    const ownerId = userId || get().ownerId;
    if (!userId || get().ownerId === userId) { clearTimeout(expiryTimer); set({ ...empty }); }
    if (ownerId) await AsyncStorage.removeItem(key(ownerId));
  },
  hasFeature: feature => {
    const state = get();
    return state.ownerId === currentOwner() && state.ownerId !== null && Date.now() - state.verifiedAt <= MAX_OFFLINE_AGE &&
      (state.plan === 'premium_lifetime' || !!state.expiryDate && Date.parse(state.expiryDate) > Date.now()) && state.features.includes(feature);
  },
}));

function scheduleExpiry(data: Entitlement, ownerId: string, verifiedAt: number) {
  clearTimeout(expiryTimer);
  if (!data.isActive) return;
  const expiresAt = Math.min(verifiedAt + MAX_OFFLINE_AGE,
    data.plan === 'premium_lifetime' ? Infinity : Date.parse(data.expiryDate!));
  expiryTimer = setTimeout(() => {
    const state = usePremiumStore.getState();
    if (state.ownerId === ownerId && state.verifiedAt === verifiedAt) state.reset();
  }, Math.max(1, expiresAt - Date.now()));
  // Node-based contract tests should not wait for a subscription expiry timer.
  (expiryTimer as any)?.unref?.();
}

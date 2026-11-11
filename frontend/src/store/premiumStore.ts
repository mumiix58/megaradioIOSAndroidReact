import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PREMIUM_KEY = 'megaradio_premium_status';
const REMOVE_ADS_KEY = 'megaradio_remove_ads';

export type PremiumPlan = 'none' | 'remove_ads' | 'premium_monthly' | 'premium_quarterly' | 'premium_yearly' | 'premium_lifetime';

interface PremiumState {
  // Status
  isPremium: boolean;
  isRemoveAds: boolean;
  plan: PremiumPlan;
  expiryDate: string | null;
  loaded: boolean;

  // Actions
  loadPremiumStatus: () => Promise<void>;
  setPremiumStatus: (plan: PremiumPlan, expiryDate?: string | null) => Promise<void>;
  clearPremium: () => Promise<void>;

  // Feature checks
  hasFeature: (feature: PremiumFeature) => boolean;
}

export type PremiumFeature = 
  | 'remove_ads'
  | 'song_info'
  | 'spotify_link'
  | 'youtube_link'
  | 'hd_stream'
  | 'song_history'
  | 'stream_record';

// Which features are available per plan
const PLAN_FEATURES: Record<PremiumPlan, PremiumFeature[]> = {
  none: [],
  remove_ads: ['remove_ads'],
  premium_monthly: ['remove_ads', 'song_info', 'spotify_link', 'youtube_link', 'hd_stream', 'song_history', 'stream_record'],
  premium_quarterly: ['remove_ads', 'song_info', 'spotify_link', 'youtube_link', 'hd_stream', 'song_history', 'stream_record'],
  premium_yearly: ['remove_ads', 'song_info', 'spotify_link', 'youtube_link', 'hd_stream', 'song_history', 'stream_record'],
  premium_lifetime: ['remove_ads', 'song_info', 'spotify_link', 'youtube_link', 'hd_stream', 'song_history', 'stream_record'],
};

export const usePremiumStore = create<PremiumState>((set, get) => ({
  isPremium: false,
  isRemoveAds: false,
  plan: 'none',
  expiryDate: null,
  loaded: false,

  loadPremiumStatus: async () => {
    try {
      const data = await AsyncStorage.getItem(PREMIUM_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const now = Date.now();

        // Check expiry for non-lifetime plans
        if (parsed.plan === 'premium_lifetime' || parsed.plan === 'remove_ads') {
          set({
            isPremium: parsed.plan !== 'remove_ads' && parsed.plan !== 'none',
            isRemoveAds: parsed.plan !== 'none',
            plan: parsed.plan,
            expiryDate: parsed.expiryDate || null,
            loaded: true,
          });
        } else if (parsed.expiryDate && new Date(parsed.expiryDate).getTime() > now) {
          set({
            isPremium: true,
            isRemoveAds: true,
            plan: parsed.plan,
            expiryDate: parsed.expiryDate,
            loaded: true,
          });
        } else {
          // Expired
          await AsyncStorage.removeItem(PREMIUM_KEY);
          set({ isPremium: false, isRemoveAds: false, plan: 'none', expiryDate: null, loaded: true });
        }
      } else {
        set({ loaded: true });
      }
    } catch (error) {
      console.error('[PremiumStore] Error loading premium status:', error);
      set({ loaded: true });
    }
  },

  setPremiumStatus: async (plan: PremiumPlan, expiryDate?: string | null) => {
    try {
      const data = { plan, expiryDate: expiryDate || null };
      await AsyncStorage.setItem(PREMIUM_KEY, JSON.stringify(data));
      
      const isPrem = plan !== 'none' && plan !== 'remove_ads';
      const isAds = plan !== 'none';
      
      set({
        isPremium: isPrem,
        isRemoveAds: isAds,
        plan,
        expiryDate: expiryDate || null,
      });
      
      console.log('[PremiumStore] Status updated:', plan, expiryDate);
    } catch (error) {
      console.error('[PremiumStore] Error saving premium status:', error);
    }
  },

  clearPremium: async () => {
    try {
      await AsyncStorage.removeItem(PREMIUM_KEY);
      set({ isPremium: false, isRemoveAds: false, plan: 'none', expiryDate: null });
      console.log('[PremiumStore] Premium cleared');
    } catch (error) {
      console.error('[PremiumStore] Error clearing premium:', error);
    }
  },

  hasFeature: (feature: PremiumFeature) => {
    const { plan } = get();
    return PLAN_FEATURES[plan]?.includes(feature) ?? false;
  },
}));

import { Platform } from 'react-native';
import { usePremiumStore, PremiumPlan } from '../store/premiumStore';
import { useAuthStore } from '../store/authStore';
import crashlyticsService from './crashlyticsService';

const API_BASE = 'https://api.themegaradio.com';

// Product IDs - must match App Store Connect & Google Play Console
export const PRODUCT_IDS = {
  REMOVE_ADS_YEARLY: 'megaradio_remove_ads_yearly1',
  PREMIUM_MONTHLY: 'megaradio_premium_monthly1',
  PREMIUM_QUARTERLY: 'megaradio_premium_quarterly',
  PREMIUM_YEARLY: 'megaradio_premium_yearly',
  PREMIUM_LIFETIME: 'megaradio_premium_lifetime',
};

const ALL_SKUS = Object.values(PRODUCT_IDS);

// Map product ID → premium plan
const PRODUCT_TO_PLAN: Record<string, PremiumPlan> = {
  [PRODUCT_IDS.REMOVE_ADS_YEARLY]: 'remove_ads',
  [PRODUCT_IDS.PREMIUM_MONTHLY]: 'premium_monthly',
  [PRODUCT_IDS.PREMIUM_QUARTERLY]: 'premium_quarterly',
  [PRODUCT_IDS.PREMIUM_YEARLY]: 'premium_yearly',
  [PRODUCT_IDS.PREMIUM_LIFETIME]: 'premium_lifetime',
};

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  currency: string;
}

// Lazy-load react-native-iap to avoid crash on web
const getIAP = () => {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-iap');
  } catch (e) {
    console.log('[IAP] react-native-iap not available:', e);
    return null;
  }
};

class IAPService {
  private isConnected = false;
  private products: IAPProduct[] = [];
  private purchaseUpdateSub: any = null;
  private purchaseErrorSub: any = null;
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (this.initialized) return this.isConnected;
    if (Platform.OS === 'web') return false;

    const iap = getIAP();
    if (!iap) return false;

    try {
      console.log('[IAP] Initializing...');
      
      // Add timeout to prevent hanging indefinitely
      const CONNECTION_TIMEOUT = 10000; // 10 seconds
      const connectionPromise = iap.initConnection();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('IAP connection timed out after 10s')), CONNECTION_TIMEOUT)
      );
      
      await Promise.race([connectionPromise, timeoutPromise]);
      this.isConnected = true;
      this.initialized = true;

      this.setupListeners(iap);
      
      // Load products with timeout
      try {
        const productsTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Products load timed out')), 8000)
        );
        await Promise.race([this.loadProducts(iap), productsTimeout]);
      } catch (e: any) {
        console.warn('[IAP] Products load timed out or failed:', e.message);
      }
      
      // Restore purchases with timeout (non-blocking)
      try {
        const restoreTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Restore timed out')), 8000)
        );
        await Promise.race([this.restorePurchases(iap), restoreTimeout]);
      } catch (e: any) {
        console.warn('[IAP] Restore timed out or failed:', e.message);
      }

      console.log('[IAP] Ready');
      return true;
    } catch (error: any) {
      console.error('[IAP] Init error:', error.message);
      crashlyticsService.recordError(error instanceof Error ? error : new Error(error.message || 'IAP init failed'), 'IAPService.initialize');
      this.initialized = true; // Mark as initialized even on failure to prevent re-init loops
      return false;
    }
  }

  private setupListeners(iap: any): void {
    this.removeListeners();

    // Purchase success listener
    this.purchaseUpdateSub = iap.purchaseUpdatedListener(async (purchase: any) => {
      console.log('[IAP] Purchase updated:', purchase.productId || purchase.id);
      try {
        await this.handlePurchaseSuccess(purchase);
        await iap.finishTransaction({ purchase, isConsumable: false });
        console.log('[IAP] Transaction finished');
      } catch (err: any) {
        console.error('[IAP] Error handling purchase:', err.message);
      }
    });

    // Purchase error listener
    this.purchaseErrorSub = iap.purchaseErrorListener((error: any) => {
      if (error.code === 'user-cancelled') {
        console.log('[IAP] User cancelled');
      } else {
        console.error('[IAP] Purchase error:', error.code, error.message);
        crashlyticsService.recordError(
          new Error(`IAP Purchase Error: ${error.code} - ${error.message}`),
          'IAPService.purchaseError'
        );
      }
    });
  }

  private removeListeners(): void {
    if (this.purchaseUpdateSub) {
      this.purchaseUpdateSub.remove();
      this.purchaseUpdateSub = null;
    }
    if (this.purchaseErrorSub) {
      this.purchaseErrorSub.remove();
      this.purchaseErrorSub = null;
    }
  }

  async loadProducts(iapModule?: any): Promise<IAPProduct[]> {
    const iap = iapModule || getIAP();
    if (!iap || !this.isConnected) return [];

    try {
      console.log('[IAP] Fetching products:', ALL_SKUS);
      
      // Add timeout to prevent hanging
      const fetchPromise = iap.fetchProducts({ skus: ALL_SKUS });
      const timeoutPromise = new Promise<any[]>((resolve) =>
        setTimeout(() => {
          console.warn('[IAP] fetchProducts timed out after 10s');
          resolve([]);
        }, 10000)
      );
      
      const products = await Promise.race([fetchPromise, timeoutPromise]);
      console.log('[IAP] Fetched', products.length, 'products');

      this.products = products.map((p: any) => ({
        productId: p.productId || p.id,
        title: p.title || p.displayName || p.productId || p.id,
        description: p.description || '',
        localizedPrice: p.localizedPrice || p.displayPrice || `${p.price} ${p.currency}`,
        currency: p.currency || 'EUR',
      }));

      return this.products;
    } catch (error: any) {
      console.error('[IAP] Load products error:', error.message);
      return [];
    }
  }

  getProducts(): IAPProduct[] {
    return this.products;
  }

  getProduct(productId: string): IAPProduct | undefined {
    return this.products.find((p) => p.productId === productId);
  }

  async purchaseSubscription(productId: string): Promise<boolean> {
    const iap = getIAP();
    if (!iap || !this.isConnected) return false;

    try {
      console.log('[IAP] Requesting purchase:', productId);

      if (Platform.OS === 'ios') {
        try { await iap.clearTransactionIOS(); } catch (e) { /* ignore */ }
      }

      // v14 API: requestPurchase with type 'subs'
      // Add timeout to prevent hanging
      const purchasePromise = iap.requestPurchase({
        request: Platform.OS === 'ios'
          ? { apple: { sku: productId } }
          : { google: { skus: [productId] } },
        type: 'subs',
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject({ code: 'E_TIMEOUT', message: 'Purchase request timed out after 30s' }), 30000)
      );
      
      await Promise.race([purchasePromise, timeoutPromise]);

      return true;
    } catch (error: any) {
      if (error.code === 'user-cancelled' || error.code === 'E_USER_CANCELLED') {
        console.log('[IAP] Cancelled by user');
        return false;
      }
      console.error('[IAP] Purchase error:', error.message);
      throw error;
    }
  }

  // For lifetime (non-consumable, one-time purchase)
  async purchaseProduct(productId: string): Promise<boolean> {
    const iap = getIAP();
    if (!iap || !this.isConnected) return false;

    try {
      console.log('[IAP] Requesting one-time purchase:', productId);

      if (Platform.OS === 'ios') {
        try { await iap.clearTransactionIOS(); } catch (e) { /* ignore */ }
      }

      const purchasePromise = iap.requestPurchase({
        request: Platform.OS === 'ios'
          ? { apple: { sku: productId } }
          : { google: { skus: [productId] } },
        type: 'in-app',
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject({ code: 'E_TIMEOUT', message: 'Purchase request timed out after 30s' }), 30000)
      );
      
      await Promise.race([purchasePromise, timeoutPromise]);

      return true;
    } catch (error: any) {
      if (error.code === 'user-cancelled' || error.code === 'E_USER_CANCELLED') return false;
      throw error;
    }
  }

  // GÖREV 1 & 4: Report purchase to backend (non-blocking)
  private async reportToBackend(purchase: any): Promise<void> {
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        console.log('[IAP] User not logged in, skipping backend notification');
        return;
      }

      const productId = purchase.productId || purchase.id;
      const body: Record<string, any> = {
        platform: Platform.OS,
        productId,
        transactionId: purchase.transactionId,
        originalTransactionId: Platform.OS === 'ios'
          ? (purchase.originalTransactionIdIOS || purchase.transactionId)
          : purchase.transactionId,
        isTrial: false,
      };

      // Platform-specific fields
      if (Platform.OS === 'ios' && purchase.transactionReceipt) {
        body.receipt = purchase.transactionReceipt;
      }
      if (Platform.OS === 'android' && purchase.purchaseToken) {
        body.purchaseToken = purchase.purchaseToken;
      }

      const response = await fetch(`${API_BASE}/api/user/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      console.log('[IAP] Backend subscription response:', data);
    } catch (error: any) {
      // Backend failure NEVER blocks the purchase — local record is already saved
      console.warn('[IAP] Backend notification failed (local record valid):', error.message);
    }
  }

  // GÖREV 2: Sync subscription status from backend on app startup
  async syncSubscriptionFromBackend(): Promise<void> {
    try {
      const { token } = useAuthStore.getState();
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/user/subscription`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      const backendPlan: PremiumPlan = data.plan || 'none';
      const backendActive: boolean = data.isActive === true;

      const localPlan = usePremiumStore.getState().plan;

      const PLAN_RANK: Record<string, number> = {
        none: 0, remove_ads: 1, premium_monthly: 2, premium_quarterly: 3, premium_yearly: 4, premium_lifetime: 5,
      };

      const backendRank = PLAN_RANK[backendPlan] || 0;
      const localRank = PLAN_RANK[localPlan] || 0;

      if (backendActive && backendRank > localRank) {
        // Backend has a better plan (purchased on another device)
        const expiryDate = data.expiryDate || null;
        await usePremiumStore.getState().setPremiumStatus(backendPlan, expiryDate);
        console.log('[IAP] Plan synced from backend:', backendPlan);
      } else if (!backendActive && localRank > 0) {
        // Backend inactive but local plan exists — keep local (may be Store-restored)
        console.log('[IAP] Backend inactive, keeping local plan:', localPlan);
      }
    } catch (error: any) {
      console.warn('[IAP] Backend subscription sync failed:', error.message);
      // On error, local plan stays valid
    }
  }

  private async handlePurchaseSuccess(purchase: any): Promise<void> {
    const productId = purchase.productId || purchase.id;
    const plan = PRODUCT_TO_PLAN[productId];
    if (!plan) {
      console.error('[IAP] Unknown product:', productId);
      return;
    }

    console.log('[IAP] Activating:', plan);

    let expiryDate: string | null = null;
    const now = Date.now();

    switch (plan) {
      case 'remove_ads':
        expiryDate = new Date(now + 365 * 86400000).toISOString();
        break;
      case 'premium_monthly':
        expiryDate = new Date(now + 30 * 86400000).toISOString();
        break;
      case 'premium_quarterly':
        expiryDate = new Date(now + 90 * 86400000).toISOString();
        break;
      case 'premium_yearly':
        expiryDate = new Date(now + 365 * 86400000).toISOString();
        break;
      case 'premium_lifetime':
        expiryDate = null;
        break;
    }

    // Step 1: Save locally (AsyncStorage) — UNCHANGED
    await usePremiumStore.getState().setPremiumStatus(plan, expiryDate);
    console.log('[IAP] Activated:', plan, expiryDate || 'LIFETIME');

    // Step 2: Report to backend (non-blocking) — NEW
    await this.reportToBackend(purchase);
  }

  async restorePurchases(iapModule?: any): Promise<boolean> {
    const iap = iapModule || getIAP();
    if (!iap || !this.isConnected) return false;

    try {
      console.log('[IAP] Restoring...');
      const purchases = await iap.getAvailablePurchases();
      console.log('[IAP] Found', purchases.length, 'purchases');

      if (!purchases.length) return false;

      let bestPlan: PremiumPlan = 'none';
      let bestExpiry: string | null = null;
      let bestPurchase: any = null;
      const ranks: Record<string, number> = {
        none: 0, remove_ads: 1, premium_monthly: 2, premium_quarterly: 3, premium_yearly: 4, premium_lifetime: 5,
      };

      for (const p of purchases) {
        const pid = p.productId || p.id;
        const plan = PRODUCT_TO_PLAN[pid];
        if (!plan) continue;

        if ((ranks[plan] || 0) > (ranks[bestPlan] || 0)) {
          bestPlan = plan;
          bestPurchase = p;
          if (plan === 'premium_lifetime') {
            bestExpiry = null;
          } else {
            const transDate = p.transactionDate ? new Date(Number(p.transactionDate)) : new Date();
            const dur = plan === 'premium_monthly' ? 30 * 86400000 : plan === 'premium_quarterly' ? 90 * 86400000 : 365 * 86400000;
            bestExpiry = new Date(transDate.getTime() + dur).toISOString();
          }
        }

        try { await iap.finishTransaction({ purchase: p, isConsumable: false }); } catch (e) { /* ignore */ }
      }

      if (bestPlan !== 'none') {
        // Step 1: Save locally — UNCHANGED
        await usePremiumStore.getState().setPremiumStatus(bestPlan, bestExpiry);
        console.log('[IAP] Restored:', bestPlan);

        // Step 2: Report best purchase to backend — NEW (GÖREV 3)
        if (bestPurchase) {
          await this.reportToBackend(bestPurchase);
        }

        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[IAP] Restore error:', error.message);
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.removeListeners();
    if (this.isConnected) {
      const iap = getIAP();
      try { if (iap) await iap.endConnection(); } catch (e) { /* ignore */ }
      this.isConnected = false;
      this.initialized = false;
    }
  }

  isAvailable(): boolean {
    return Platform.OS !== 'web' && this.isConnected;
  }
}

export const iapService = new IAPService();
export default iapService;

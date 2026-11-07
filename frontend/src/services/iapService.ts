import { Platform } from 'react-native';
import { usePremiumStore, parseEntitlement } from '../store/premiumStore';
import { useAuthStore } from '../store/authStore';
import api from './api';
import { isCurrentSession, sessionVersion } from './sessionRuntime';

export const PRODUCT_IDS = {
  REMOVE_ADS_YEARLY: 'megaradio_remove_ads_yearly1',
  PREMIUM_MONTHLY: 'megaradio_premium_monthly1',
  PREMIUM_YEARLY: 'megaradio_premium_yearly',
  PREMIUM_LIFETIME: 'megaradio_premium_lifetime',
};
const ALL_SKUS = Object.values(PRODUCT_IDS);
const RANK: Record<string, number> = {
  [PRODUCT_IDS.REMOVE_ADS_YEARLY]: 1, [PRODUCT_IDS.PREMIUM_MONTHLY]: 2,
  [PRODUCT_IDS.PREMIUM_YEARLY]: 3, [PRODUCT_IDS.PREMIUM_LIFETIME]: 4,
};
export interface IAPProduct { productId: string; title: string; description: string; localizedPrice: string; currency: string; }
const getIAP = () => {
  if (Platform.OS === 'web') return null;
  try { return require('react-native-iap'); } catch { return null; }
};
const cancelled = (error: any) => ['user-cancelled', 'E_USER_CANCELLED'].includes(error?.code);
const alreadyOwned = (error: any) => ['already-owned', 'E_ALREADY_OWNED'].includes(error?.code);
const PLAN_PRODUCTS: Record<string, string> = {
  remove_ads: PRODUCT_IDS.REMOVE_ADS_YEARLY, premium_monthly: PRODUCT_IDS.PREMIUM_MONTHLY,
  premium_yearly: PRODUCT_IDS.PREMIUM_YEARLY, premium_lifetime: PRODUCT_IDS.PREMIUM_LIFETIME,
};
export function hasPurchasedAccess(productId: string): boolean {
  const state = usePremiumStore.getState();
  const userId = useAuthStore.getState().user?._id;
  if (!userId || state.ownerId !== userId || !state.verifiedAt || Date.now() - state.verifiedAt > 86400000) return false;
  if (state.plan !== 'premium_lifetime' && (!state.expiryDate || Date.parse(state.expiryDate) <= Date.now())) return false;
  // Changing an existing Premium billing period belongs in the store's management sheet.
  return state.isPremium || (productId === PRODUCT_IDS.REMOVE_ADS_YEARLY && state.isRemoveAds);
}
const owner = () => {
  const { token, user } = useAuthStore.getState();
  if (!token || !user?._id) throw new Error('Sign in to purchase or restore your subscription.');
  return { token, userId: user._id, version: sessionVersion() };
};
type Owner = ReturnType<typeof owner>;
function assertOwner(expected: Owner) {
  if (!isCurrentSession(expected.version) || useAuthStore.getState().token !== expected.token) {
    throw new Error('The account changed. Sign in to the purchasing account and restore the purchase.');
  }
}
async function withTimeout<T>(task: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    })]);
  } finally { clearTimeout(timer!); }
}

class IAPService {
  private isConnected = false;
  private initialization: Promise<boolean> | null = null;
  private products: IAPProduct[] = [];
  private rawProducts: any[] = [];
  private purchaseUpdateSub: any = null;
  private purchaseErrorSub: any = null;
  private processing = new Map<string, Promise<void>>();
  private operation: 'purchase' | 'restore' | null = null;
  private checkout: { productId: string; owner: Owner; recovery?: Promise<boolean>; resolve: (value: boolean) => void; reject: (error: Error) => void } | null = null;

  async initialize(): Promise<boolean> {
    if (this.isConnected) {
      if (!this.products.length) {
        try { await this.loadProducts(); } catch { return false; }
      }
      return true;
    }
    if (this.initialization) return this.initialization;
    const iap = getIAP();
    if (!iap) return false;
    this.initialization = (async () => {
      try {
        await withTimeout(iap.initConnection(), 10000, 'Store connection timed out.');
        this.isConnected = true;
        this.setupListeners(iap);
        await this.loadProducts(iap);
        // Restore is an explicit account-bound action, not a side effect of opening the paywall.
        return true;
      } catch {
        return false;
      } finally { this.initialization = null; }
    })();
    return this.initialization;
  }

  private setupListeners(iap: any) {
    this.removeListeners();
    this.purchaseUpdateSub = iap.purchaseUpdatedListener(async (purchase: any) => {
      const checkout = this.checkout?.productId === purchase.productId ? this.checkout : null;
      try {
        if (purchase.purchaseState !== 'purchased') {
          if (checkout) checkout.reject(new Error('The store has not completed this purchase yet. Restore it after approval.'));
          return;
        }
        // An interrupted purchase is recoverable after login via explicit Restore.
        if (!checkout) return;
        await this.completePurchase(purchase, iap, checkout?.owner || owner());
        checkout?.resolve(true);
      } catch (error: any) {
        checkout?.reject(new Error(error.response?.data?.error || error.message || 'Purchase verification failed. Please try Restore.'));
      }
    });
    this.purchaseErrorSub = iap.purchaseErrorListener((error: any) => {
      if (this.checkout) void this.handleCheckoutError(error, this.checkout, iap);
    });
  }

  private removeListeners() {
    this.purchaseUpdateSub?.remove(); this.purchaseUpdateSub = null;
    this.purchaseErrorSub?.remove(); this.purchaseErrorSub = null;
  }

  private async handleCheckoutError(error: any, checkout: NonNullable<IAPService['checkout']>, iap: any) {
    if (this.checkout !== checkout) return;
    if (cancelled(error)) { checkout.resolve(false); return; }
    if (alreadyOwned(error)) {
      try {
        checkout.recovery ??= this.recoverOwnedPurchase(iap, checkout.owner, checkout.productId);
        if (await checkout.recovery) { checkout.resolve(true); return; }
      } catch (recoveryError: any) { checkout.reject(recoveryError); return; }
    }
    checkout.reject(new Error(error.message || 'Purchase failed.'));
  }

  async loadProducts(iapModule?: any): Promise<IAPProduct[]> {
    const iap = iapModule || getIAP();
    if (!iap || !this.isConnected) return [];
    this.rawProducts = await withTimeout<any[]>(iap.fetchProducts({ skus: ALL_SKUS, type: 'all' }), 10000, 'Store products could not be loaded.');
    this.products = this.rawProducts.map(p => ({
      productId: p.id || p.productId, title: p.displayName || p.title || p.id,
      description: p.description || '', localizedPrice: p.displayPrice || p.localizedPrice || '', currency: p.currency || '',
    }));
    return this.products;
  }
  getProducts() { return this.products; }
  getProduct(productId: string) { return this.products.find(p => p.productId === productId); }

  private async purchase(productId: string, type: 'subs' | 'in-app'): Promise<boolean> {
    if (this.operation) throw new Error('A store operation is already in progress.');
    this.operation = 'purchase';
    try { return await this.performPurchase(productId, type); }
    finally { this.operation = null; }
  }

  private async performPurchase(productId: string, type: 'subs' | 'in-app'): Promise<boolean> {
    const account = owner();
    if (!ALL_SKUS.includes(productId)) throw new Error('Unknown store product.');
    if (hasPurchasedAccess(productId)) return true;
    const iap = getIAP();
    if (!iap || !await this.initialize()) throw new Error('The store is unavailable. Please try again.');
    assertOwner(account);
    if (this.checkout) throw new Error('A purchase is already in progress.');
    // StoreKit can return no new transaction for a subscription already owned.
    // Reconcile that entitlement before opening another payment sheet.
    if (Platform.OS === 'ios' && await this.recoverOwnedPurchase(iap, account, productId)) return true;
    assertOwner(account);
    if (!this.getProduct(productId)) {
      await this.loadProducts(iap);
      if (!this.getProduct(productId)) throw new Error('This product is not available in your store.');
    }
    assertOwner(account);
    const google: any = { skus: [productId] };
    if (type === 'subs' && Platform.OS === 'android') {
      const product = this.rawProducts.find(p => (p.id || p.productId) === productId);
      const offers = product?.subscriptionOfferDetailsAndroid || [];
      const offer = offers.find((o: any) => !o.offerId && o.offerToken) || offers.find((o: any) => o.offerToken);
      if (!offer) throw new Error('No subscription offer is available in your store.');
      google.subscriptionOffers = [{ sku: productId, offerToken: offer.offerToken }];
    }
    let checkout!: NonNullable<IAPService['checkout']>;
    const completion = new Promise<boolean>((resolve, reject) => {
      checkout = { productId, owner: account, resolve, reject };
      this.checkout = checkout;
    });
    // Attach the timeout handler before a synchronous native error can reject completion.
    const verified = withTimeout(completion, 90000, 'Purchase confirmation is pending. Please use Restore to check it again.');
    void Promise.resolve().then(() => iap.requestPurchase({
      request: Platform.OS === 'ios' ? { apple: { sku: productId } } : { google }, type,
    })).then(async (result: any) => {
      // Some SDK/platform paths return the purchase as well as emitting the listener.
      for (const purchase of (Array.isArray(result) ? result : result ? [result] : [])) {
        if (purchase.productId !== productId || purchase.purchaseState !== 'purchased') continue;
        await this.completePurchase(purchase, iap, account);
        checkout.resolve(true);
      }
    }).catch(error => this.handleCheckoutError(error, checkout, iap));
    try { return await verified; }
    finally { if (this.checkout === checkout) this.checkout = null; }
  }
  purchaseSubscription(productId: string) { return this.purchase(productId, 'subs'); }
  purchaseProduct(productId: string) { return this.purchase(productId, 'in-app'); }

  private async availablePurchases(iap: any): Promise<any[]> {
    return withTimeout<any[]>(iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true, alsoPublishToEventListenerIOS: false }),
      12000, 'The store did not return your subscriptions. Please try Restore again.');
  }

  private async recoverOwnedPurchase(iap: any, account: Owner, productId: string): Promise<boolean> {
    const purchases = await this.availablePurchases(iap);
    assertOwner(account);
    const candidates = purchases.filter(p => RANK[p.productId] && p.purchaseState === 'purchased' &&
      (p.productId === productId || p.productId !== PRODUCT_IDS.REMOVE_ADS_YEARLY))
      .sort((a, b) => RANK[b.productId] - RANK[a.productId] || Number(b.transactionDate) - Number(a.transactionDate));
    if (!candidates.length) return false;
    const purchase = candidates[0];
    this.processing.delete(`${account.version}:${purchase.transactionId || purchase.id}`);
    await this.completePurchase(purchase, iap, account);
    return true;
  }

  async manageSubscriptions(): Promise<void> {
    if (Platform.OS === 'ios') {
      const iap = getIAP();
      if (!iap?.showManageSubscriptionsIOS) throw new Error('Subscription management is unavailable.');
      await iap.showManageSubscriptionsIOS();
    } else if (Platform.OS === 'android') {
      const { Linking } = require('react-native');
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else throw new Error('Open subscription management in the store where you subscribed.');
    await this.syncSubscriptionFromBackend();
  }

  private async reportToBackend(purchase: any, iap: any, account: Owner) {
    assertOwner(account);
    const productId = purchase.productId;
    if (!ALL_SKUS.includes(productId)) throw new Error('Unknown store product.');
    const body: Record<string, string> = { platform: Platform.OS, productId };
    if (Platform.OS === 'ios') {
      // v14 purchaseToken is StoreKit 2 JWS. The server expects the app's base64 receipt.
      let receipt: string | null = null;
      try { receipt = await withTimeout<string>(iap.getReceiptIOS(), 10000, 'Apple receipt lookup timed out.'); } catch { /* Refresh below for a missing app receipt. */ }
      if (!receipt) receipt = await withTimeout<string>(iap.requestReceiptRefreshIOS(), 20000, 'Apple receipt verification is pending. Please try Restore.');
      if (typeof receipt !== 'string' || !receipt.trim() || receipt.includes('.')) throw new Error('The Apple receipt is unavailable. Please try Restore.');
      body.receipt = receipt;
    } else {
      if (!purchase.purchaseToken) throw new Error('The Google Play purchase token is missing.');
      body.purchaseToken = purchase.purchaseToken;
    }
    assertOwner(account);
    const response = await api.post('/api/user/subscription', body, { headers: { Authorization: `Bearer ${account.token}` } });
    assertOwner(account);
    if (response.data?.success !== true) throw new Error(response.data?.error || 'Purchase verification failed.');
    const entitlement = parseEntitlement(response.data);
    if (!entitlement.isActive) throw new Error('This purchase is no longer active.');
    return entitlement;
  }

  private async completePurchase(purchase: any, iap: any, account: Owner): Promise<void> {
    assertOwner(account);
    const transaction = purchase.transactionId || purchase.id;
    if (!transaction || purchase.purchaseState !== 'purchased') throw new Error('Purchase is not completed.');
    const key = `${account.version}:${transaction}`;
    const existing = this.processing.get(key);
    if (existing) return existing;
    const job = (async () => {
      const entitlement = await this.reportToBackend(purchase, iap, account);
      assertOwner(account);
      await usePremiumStore.getState().applyEntitlement(entitlement, account.userId);
      assertOwner(account);
      // Invalid/conflicting/unavailable backend responses never finish the transaction.
      await withTimeout(iap.finishTransaction({ purchase, isConsumable: false }), 15000,
        'Your subscription is verified. The store will finish processing it when you restore.');
    })();
    this.processing.set(key, job);
    try { await job; }
    catch (error) { this.processing.delete(key); throw error; }
    // Keep successful IDs for this process to deduplicate SDK callback/return paths.
  }

  async syncSubscriptionFromBackend(): Promise<void> {
    if (!useAuthStore.getState().token) return;
    const account = owner();
    const previous = usePremiumStore.getState();
    const requestedAt = Date.now();
    const response = await api.get('/api/user/subscription');
    assertOwner(account);
    const current = usePremiumStore.getState();
    // An older GET must not undo a purchase/restore verified while it was in flight.
    if (current.verifiedAt >= requestedAt && (current.verifiedAt !== previous.verifiedAt || current.plan !== previous.plan)) return;
    await usePremiumStore.getState().applyEntitlement(parseEntitlement(response.data), account.userId);
  }

  async restorePurchases(iapModule?: any): Promise<boolean> {
    if (this.operation) throw new Error('A store operation is already in progress.');
    this.operation = 'restore';
    try { return await this.performRestore(iapModule); }
    finally { this.operation = null; }
  }

  private async performRestore(iapModule?: any): Promise<boolean> {
    const account = owner();
    if (this.checkout) throw new Error('A purchase is already in progress.');
    const iap = iapModule || getIAP();
    if (!iap || (!this.isConnected && !await this.initialize())) throw new Error('The store is unavailable.');
    const purchases: any[] = await this.availablePurchases(iap);
    assertOwner(account);
    const candidates = purchases.filter(p => RANK[p.productId] && p.purchaseState === 'purchased')
      .sort((a, b) => RANK[b.productId] - RANK[a.productId] || Number(b.transactionDate) - Number(a.transactionDate));
    if (!candidates.length) {
      await this.syncSubscriptionFromBackend();
      return hasPurchasedAccess(PLAN_PRODUCTS[usePremiumStore.getState().plan]);
    }
    // Never invent expiry from transactionDate or activate a purchase without verification.
    this.processing.delete(`${account.version}:${candidates[0].transactionId || candidates[0].id}`);
    await this.completePurchase(candidates[0], iap, account);
    // POST already returned the authoritative entitlement. A lagging GET replica
    // must not immediately replace the successful restore with an inactive plan.
    return true;
  }
  async destroy() {
    this.removeListeners();
    this.checkout?.reject(new Error('Store connection closed.'));
    this.checkout = null;
    if (this.isConnected) await getIAP()?.endConnection();
    this.isConnected = false;
    this.processing.clear();
  }
  isAvailable() { return Platform.OS !== 'web' && this.isConnected; }
}
export const iapService = new IAPService();
export default iapService;

// Paywall Context — exposes `showPaywall(variant)` anywhere in the app.
// Handles native IAP bridge if running inside the tvOS/Android/Electron shell.

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { PremiumPaywall, PaywallVariant } from '@/components/PremiumPaywall';
import { usePremium } from '@/hooks/usePremium';
import { isMacAppStore } from '@/lib/platform';

interface PaywallContextType {
  showPaywall: (variant?: PaywallVariant) => void;
  hidePaywall: () => void;
  isPremium: boolean;
  adsRemoved: boolean;
}

const PaywallContext = createContext<PaywallContextType | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<PaywallVariant>('premium');
  const premium = usePremium();

  const showPaywall = useCallback((v: PaywallVariant = 'premium') => {
    // This Mac app currently has no paid-only capabilities or app-inserted ads.
    if (isMacAppStore()) { window.location.hash = '#/premium-upgrade'; return; }
    if (v === 'premium' && premium.isPremium) return;
    if (v === 'remove_ads' && premium.adsRemoved) return;

    // CRITICAL ROUTING DECISION:
    //   - On platforms WITH a native IAP bridge (tvOS / Android TV /
    //     Mac App Store Electron), the in-app paywall stays — those stores
    //     REQUIRE checkout to happen via their native dialog.
    //   - On EVERY other surface (Samsung Tizen / LG WebOS / Windows or
    //     Linux Electron / browser preview), in-app payment is BANNED by
    //     the store policy AND a relative URL is cheaper to maintain.
    //     Route those users to `/premium-upgrade` instead, where they see
    //     a QR + 6-digit PIN that takes them to the website to pay.
    const hasNativeBridge = (window as any).megaRadioNative?.supportsNativeIap === true;
    if (!hasNativeBridge) {
      // Hash-based wouter router → use location.hash, not pushState.
      try { window.location.hash = '#/premium-upgrade'; } catch (_) { /* noop */ }
      return;
    }

    setVariant(v);
    setOpen(true);
  }, [premium.isPremium, premium.adsRemoved]);

  const hidePaywall = useCallback(() => setOpen(false), []);

  // Auto-show paywall after 45s on app launch (once per session, non-premium only).
  // Skipped on splash, login, paywall, and onboarding screens to avoid awkward overlap.
  useEffect(() => {
    if (isMacAppStore() || !premium.ready || premium.isPremium) return;
    const SHOWN_KEY = 'mr_auto_paywall_shown_session';
    if (sessionStorage.getItem(SHOWN_KEY) === '1') return;

    const timer = setTimeout(() => {
      const path = (typeof window !== 'undefined' && window.location.hash) || '';
      // Don't auto-popup on these routes (already addressing premium / boot).
      const blockedRoutes = ['#/', '#/login', '#/premium', '#/remove-ads', '#/guide-1', '#/guide-2', '#/guide-3', '#/guide-4', '#/premium-upgrade', '#/onboarding-premium', '#/manage-subscription'];
      const isBlocked = blockedRoutes.some(r => path === r || path.startsWith(r + '?'));
      if (isBlocked) return;
      sessionStorage.setItem(SHOWN_KEY, '1');

      // Same routing rule as showPaywall — Tizen/WebOS/Desktop/Web go to
      // the QR upgrade screen, native-IAP platforms see the in-app paywall.
      const hasNativeBridge = (window as any).megaRadioNative?.supportsNativeIap === true;
      if (!hasNativeBridge) {
        try { window.location.hash = '#/premium-upgrade'; } catch (_) { /* noop */ }
        return;
      }
      setVariant('premium');
      setOpen(true);
    }, 45_000);

    return () => clearTimeout(timer);
  }, [premium.isPremium, premium.ready]);

  const onPurchase = useCallback(async (productId: string) => {
    const bridge = (window as any).megaRadioNative;
    const token = localStorage.getItem('tv_auth_token');
    if (isMacAppStore() && productId !== 'restore') return;
    if (!bridge?.supportsNativeIap) { window.location.hash = '#/premium-upgrade'; return; }
    if (!token) { alert('Please sign in before purchasing or restoring.'); return; }
    try {
      await bridge.setAuthToken(token);
      // Keep the same session throughout this request, including native setup.
      if (localStorage.getItem('tv_auth_token') !== token) return;
      if (productId === 'restore') {
        if (bridge.restorePurchases) {
          const result = await bridge.restorePurchases(token);
          if (!result?.ok) alert(result?.message || 'Restore could not start.');
          else if (result.pending) alert('Restore requested. Store verification may take a moment.');
        } else {
          alert('Restore Purchases is unavailable in this app version.');
        }
        return;
      }
      if (bridge.purchase) {
        const result = await bridge.purchase(productId, token);
        if (!result?.ok) alert(result?.message || 'Purchase could not start.');
      } else {
        window.location.hash = '#/premium-upgrade';
      }
    } catch (error: any) { alert(error?.message || 'Purchase could not start.'); }
  }, []);

  // Listen for native IAP events (Electron CustomEvents) and surface backend
  // errors + success to the user.
  useEffect(() => {
    const onCompleted = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      // Backend already verified — apply locally and close paywall
      if (detail.server) premium.applyVerified(detail.server);
      setOpen(false);
    };
    const onFailed = (e: Event) => {
      if (isMacAppStore()) return; // The Mac account page owns its restore status.
      const detail = (e as CustomEvent).detail || {};
      const msg = detail.message || detail.error || 'Satın alma tamamlanamadı.';
      alert('⚠️ ' + msg);
    };
    const onRestored = (e: Event) => {
      if (isMacAppStore()) return;
      const detail = (e as CustomEvent).detail || {};
      if (detail.server?.isActive) {
        // Backend confirmed: refresh local state by re-reading from server next mount
        window.dispatchEvent(new CustomEvent('mr:premium-changed'));
        setOpen(false);
        alert('✓ Önceki satın alımlarınız geri yüklendi.');
      } else {
        alert('Geri yüklenecek aktif bir satın alma bulunamadı.');
      }
    };
    window.addEventListener('mr-iap-completed', onCompleted);
    window.addEventListener('mr-iap-failed', onFailed);
    window.addEventListener('mr-iap-restored', onRestored);
    return () => {
      window.removeEventListener('mr-iap-completed', onCompleted);
      window.removeEventListener('mr-iap-failed', onFailed);
      window.removeEventListener('mr-iap-restored', onRestored);
    };
  }, [premium]);

  return (
    <PaywallContext.Provider value={{
      showPaywall, hidePaywall,
      isPremium: premium.isPremium,
      adsRemoved: premium.adsRemoved,
    }}>
      {children}
      <PremiumPaywall
        open={open && !isMacAppStore()}
        variant={variant}
        onClose={hidePaywall}
        onPurchase={onPurchase}
      />
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error('usePaywall must be used within PaywallProvider');
  return ctx;
}

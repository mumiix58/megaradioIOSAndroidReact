import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePremiumStore } from '../store/premiumStore';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '../services/analyticsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const S = SCREEN_WIDTH / 375;

// Conditionally import IAP service (only on native)
const getIAPService = () => {
  if (Platform.OS === 'web') return null;
  try {
    return require('../services/iapService').iapService;
  } catch (e) {
    return null;
  }
};

const getProductIds = () => {
  if (Platform.OS === 'web') return {};
  try {
    return require('../services/iapService').PRODUCT_IDS;
  } catch (e) {
    return {};
  }
};

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'premium' | 'remove_ads';
  source?: 'profile' | 'player' | 'feature' | 'unknown';
}

const PREMIUM_FEATURES = [
  { key: 'remove_ads', icon: 'ban-outline' as const },
  { key: 'song_info', icon: 'musical-notes-outline' as const },
  { key: 'spotify_youtube', icon: 'logo-youtube' as const },
  { key: 'hd_stream', icon: 'radio-outline' as const },
  { key: 'song_history', icon: 'time-outline' as const },
  { key: 'and_more', icon: 'sparkles-outline' as const },
];

type PricingOption = 'monthly' | 'yearly' | 'lifetime';

export const PremiumPaywall: React.FC<PremiumPaywallProps> = ({ visible, onClose, mode = 'premium', source = 'unknown' }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PricingOption>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [iapReady, setIapReady] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productAttempt, setProductAttempt] = useState(0);
  const viewedAt = useRef<number | null>(null);
  const purchaseSucceeded = useRef(false);
  const operation = useRef(false);
  const { isPremium, isRemoveAds, plan } = usePremiumStore();
  const covered = isPremium || (mode === 'remove_ads' && isRemoveAds);

  useEffect(() => {
    if (!visible) return;
    viewedAt.current = Date.now();
    purchaseSucceeded.current = false;
    void analyticsService.logDiagnosticEvent('paywall_view', { source, offer_mode: mode });
    return () => {
      void analyticsService.logDiagnosticEvent('paywall_closed', {
        source, offer_mode: mode, converted: purchaseSucceeded.current ? 1 : 0,
        duration_seconds: Math.min(86400, Math.round((Date.now() - (viewedAt.current || Date.now())) / 1000)),
      });
    };
  }, [visible, mode, source]);

  // Display store-localized prices, and ignore late responses after this offer closes.
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    let active = true;
    setPrices({});
    setIapReady(false);
    setLoadingProducts(true);
    const initIAP = async () => {
      try {
        const iap = getIAPService();
        if (!iap) return;
        void iap.syncSubscriptionFromBackend().catch(() => {});
        await iap.initialize();
        const products = productAttempt > 0 ? await iap.loadProducts() : iap.getProducts();
        const PIDS = getProductIds();
        const priceMap: Record<string, string> = {};
        products.forEach((p: any) => {
          if (p.productId === PIDS.REMOVE_ADS_YEARLY) priceMap.remove_ads = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_MONTHLY) priceMap.monthly = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_YEARLY) priceMap.yearly = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_LIFETIME) priceMap.lifetime = p.localizedPrice;
        });
        if (!active) return;
        setPrices(priceMap);
        setIapReady(products.length > 0);
        void analyticsService.logDiagnosticEvent('paywall_products_loaded', {
          source, offer_mode: mode, product_count: products.length,
          selected_available: (mode === 'remove_ads' ? !!priceMap.remove_ads : !!priceMap.yearly) ? 1 : 0,
        });
      } catch {
        if (active) void analyticsService.logDiagnosticEvent('paywall_products_failed', { source, offer_mode: mode });
      } finally {
        if (active) setLoadingProducts(false);
      }
    };
    void initIAP();
    return () => { active = false; };
  }, [visible, productAttempt, mode, source]);

  const requireLogin = () => {
    if (useAuthStore.getState().token) return true;
    void analyticsService.logDiagnosticEvent('paywall_login_required', { source, offer_mode: mode });
    onClose();
    router.push('/auth-options');
    return false;
  };

  const handleSubscribe = useCallback(async () => {
    if (operation.current) return;
    if (!requireLogin()) return;
    const iap = getIAPService();
    const PIDS = getProductIds();
    
    if (!iap || !PIDS.PREMIUM_MONTHLY) {
      Alert.alert(
        t('not_available', 'Not Available'),
        t('iap_not_available', 'In-App Purchases are not available on this device.'),
        [{ text: 'OK' }]
      );
      return;
    }

    operation.current = true;
    setIsLoading(true);

    try {
      let productId: string;
      
      if (mode === 'remove_ads') {
        productId = PIDS.REMOVE_ADS_YEARLY;
      } else {
        switch (selectedPlan) {
          case 'monthly':
            productId = PIDS.PREMIUM_MONTHLY;
            break;
          case 'yearly':
            productId = PIDS.PREMIUM_YEARLY;
            break;
          case 'lifetime':
            productId = PIDS.PREMIUM_LIFETIME;
            break;
          default:
            productId = PIDS.PREMIUM_YEARLY;
        }
      }

      
      // Check if IAP is actually connected before attempting purchase
      if (!iap.isAvailable()) {
        Alert.alert(
          t('not_available', 'Not Available'),
          t('iap_not_connected', 'Store connection is not ready. Please try again in a moment.'),
          [{ text: 'OK' }]
        );
        return;
      }
      
      void analyticsService.logDiagnosticEvent('checkout_started', { source, offer_mode: mode, product_id: productId });

      // Lifetime is a one-time purchase, others are subscriptions
      let result: boolean;
      if (selectedPlan === 'lifetime' && mode !== 'remove_ads') {
        result = await iap.purchaseProduct(productId);
      } else {
        result = await iap.purchaseSubscription(productId);
      }
      
      // The service resolves only after backend verification and transaction completion.
      if (result) {
        purchaseSucceeded.current = true;
        void analyticsService.logDiagnosticEvent('checkout_result', { source, offer_mode: mode, result: 'verified' });
        onClose();
      } else {
        void analyticsService.logDiagnosticEvent('checkout_result', { source, offer_mode: mode, result: 'cancelled' });
      }
    } catch (error: any) {
      const cancelled = ['E_USER_CANCELLED', 'user-cancelled'].includes(error?.code);
      void analyticsService.logDiagnosticEvent('checkout_result', { source, offer_mode: mode, result: cancelled ? 'cancelled' : 'failed' });
      if (!cancelled) {
        Alert.alert(
          t('purchase_error', 'Purchase Error'),
          error.message || t('purchase_failed', 'Purchase could not be completed. Please try again.'),
          [{ text: 'OK' }]
        );
      }
    } finally {
      operation.current = false;
      setIsLoading(false);
    }
  }, [mode, selectedPlan, source, t, onClose]);

  const handleRestore = useCallback(async () => {
    if (operation.current) return;
    if (!requireLogin()) return;
    const iap = getIAPService();
    if (!iap) return;
    
    operation.current = true;
    setIsLoading(true);
    try {
      void analyticsService.logDiagnosticEvent('restore_started', { source, offer_mode: mode });
      const restored = await iap.restorePurchases();
      void analyticsService.logDiagnosticEvent('restore_result', { source, offer_mode: mode, result: restored ? 'verified' : 'empty' });
      if (restored) {
        Alert.alert(
          t('restored', 'Restored!'),
          t('purchase_restored', 'Your purchase has been restored successfully.'),
          [{ text: 'OK', onPress: onClose }]
        );
      } else {
        Alert.alert(
          t('no_purchase', 'No Purchase Found'),
          t('no_purchase_desc', 'No previous purchases were found for this account.'),
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      void analyticsService.logDiagnosticEvent('restore_result', { source, offer_mode: mode, result: 'failed' });
      Alert.alert(t('error', 'Error'), error.message);
    } finally {
      operation.current = false;
      setIsLoading(false);
    }
  }, [mode, source, t, onClose]);

  if (!visible) return null;

  // A confirmed entitlement replaces the offer, including after an interrupted checkout.
  if (covered) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={[styles.container, { padding: 28, paddingTop: insets.top + 60, justifyContent: 'center', gap: 24 }]}>
          <Ionicons name="checkmark-circle" size={64} color="#4CAF50" style={{ alignSelf: 'center' }} />
          <Text style={styles.premiumTitle}>{isPremium ? t('premium_active', 'Premium Active') : t('ad_free_active', 'Ad-free Active')}</Text>
          <Text style={[styles.premiumSubtitle, { textAlign: 'center' }]}>{t('subscription_already_active', 'Your subscription is active. No new purchase is needed.')}</Text>
          {plan !== 'premium_lifetime' && (
            <TouchableOpacity style={styles.ctaButton} onPress={async () => {
              try { await getIAPService()?.manageSubscriptions(); }
              catch (error: any) { Alert.alert(t('error', 'Error'), error.message); }
            }} testID="premium-manage-subscription">
              <Text style={styles.ctaText}>{t('manage_subscription', 'Manage subscription')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.ctaButton} onPress={onClose} testID="premium-active-done">
            <Text style={styles.ctaText}>{t('done', 'Done')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // ─── Remove Ads Paywall (Simple) ───
  if (mode === 'remove_ads') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <View style={styles.container}>
          <LinearGradient colors={['#1a0a2e', '#16082a', '#0D0D0F']} style={StyleSheet.absoluteFill} pointerEvents="none" />
          
          <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={onClose} data-testid="remove-ads-close-btn">
            <View style={styles.closeBtnCircle}>
              <Ionicons name="close" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>

          <ScrollView 
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, paddingBottom: Math.max(80, 40 + insets.bottom) }]} 
            showsVerticalScrollIndicator={false}
            bounces={true}
            nestedScrollEnabled={true}
            overScrollMode="always"
          >
            <View style={styles.heroSection}>
              <View style={styles.heroImagePlaceholder}>
                <Ionicons name="headset" size={80 * S} color="#FF4199" />
              </View>
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.brandName}>MegaRadio</Text>
              <Text style={styles.removeAdsTitle}>{t('remove_ads_title', 'Remove Ads')}</Text>
            </View>

            <Text style={styles.removeAdsDesc}>{t('tired_of_ads', 'Tired of seeing ads?')}</Text>
            <Text style={styles.removeAdsSubDesc}>{t('app_ads_only', 'Remove advertisements shown by MegaRadio.')}</Text>

            <Text style={styles.trialInfoText}>{t('broadcaster_ads_remain', 'Advertisements within radio broadcasts are provided by the station and cannot be removed.')}</Text>

            <View style={styles.removeAdsPriceBox}>
              <Text style={styles.removeAdsPriceText}>
                {prices.remove_ads || '—'}/{t('yearly_lc', 'yearly')}, {t('cancel_anytime', 'cancel anytime')}
              </Text>
            </View>

            <TouchableOpacity style={styles.ctaButton} onPress={handleSubscribe} disabled={isLoading || !prices.remove_ads} data-testid="remove-ads-subscribe-btn">
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>{t('remove_ads_btn', 'Remove Ads')}</Text>}
            </TouchableOpacity>

            {(!prices.remove_ads && !loadingProducts) && (
              <TouchableOpacity onPress={() => setProductAttempt(n => n + 1)} testID="remove-ads-retry-prices">
                <Text style={styles.trialInfoText}>{t('retry_store_prices', 'Prices could not be loaded. Tap to retry.')}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
                <Text style={styles.footerLink}>{t('restore_purchases', 'Restore purchases')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { 
                onClose(); 
                setTimeout(() => router.push('/static-page?type=terms'), 400);
              }}>
                <Text style={styles.footerLink}>{t('terms_conditions', 'Terms & Conditions')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { 
                onClose(); 
                setTimeout(() => router.push('/static-page?type=privacy'), 400);
              }}>
                <Text style={styles.footerLink}>{t('privacy_policy', 'Privacy Policy')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ─── Full Premium Paywall ───
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <LinearGradient colors={['#1a0a2e', '#16082a', '#0D0D0F']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={onClose} data-testid="premium-close-btn">
          <View style={styles.closeBtnCircle}>
            <Ionicons name="close" size={20} color="#FFF" />
          </View>
        </TouchableOpacity>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: Math.max(80, 40 + insets.bottom) }]} 
          showsVerticalScrollIndicator={false}
          bounces={true}
          nestedScrollEnabled={true}
          overScrollMode="always"
        >
          {/* Crown + Title */}
          <View style={styles.crownSection}>
            <View style={styles.crownBox}>
              <Ionicons name="diamond" size={28} color="#FFD700" />
            </View>
          </View>

          <Text style={styles.premiumTitle}>{t('go_premium', 'Go Premium')}</Text>
          <Text style={styles.premiumSubtitle}>{t('unlock_features', 'To unlock amazing features')}</Text>

          {/* Features */}
          <View style={styles.featuresList}>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature.key} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
                <Text style={styles.featureText}>
                  {feature.key === 'remove_ads' && t('feat_remove_ads', 'Remove Ads')}
                  {feature.key === 'song_info' && t('feat_song_info', 'Now Playing Song Info')}
                  {feature.key === 'spotify_youtube' && t('feat_spotify_youtube', 'Spotify & YouTube Music Support')}
                  {feature.key === 'hd_stream' && t('feat_hd_stream', 'HD Stream')}
                  {feature.key === 'song_history' && t('feat_song_history', 'Song History')}
                  {feature.key === 'and_more' && t('feat_and_more', 'And More...')}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.trialInfoText}>{t('broadcaster_ads_remain', 'Advertisements within radio broadcasts are provided by the station and cannot be removed.')}</Text>

          {/* Pricing Options */}
          <View style={styles.pricingSection}>
            <TouchableOpacity
              style={[styles.priceOption, selectedPlan === 'yearly' && styles.priceOptionSelected]}
              onPress={() => setSelectedPlan('yearly')}
              data-testid="premium-yearly-option"
            >
              <View style={styles.radioOuter}>
                {selectedPlan === 'yearly' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.priceInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.priceLabel}>{t('yearly', 'Yearly')}</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>{t('recommended', 'Recommended')}</Text>
                  </View>
                </View>
                <Text style={styles.priceSub}>{t('cancel_anytime', 'cancel anytime')}</Text>
              </View>
              <Text style={styles.priceAmount}>{prices.yearly || '—'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.priceOption, selectedPlan === 'lifetime' && styles.priceOptionSelected]}
              onPress={() => setSelectedPlan('lifetime')}
              data-testid="premium-lifetime-option"
            >
              <View style={styles.radioOuter}>
                {selectedPlan === 'lifetime' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.priceInfo}>
                <Text style={styles.priceLabel}>{t('lifetime', 'Lifetime')}</Text>
                <Text style={styles.priceSub}>{t('one_time_payment', 'one-time payment')}</Text>
              </View>
              <Text style={styles.priceAmount}>{prices.lifetime || '—'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.priceOption, selectedPlan === 'monthly' && styles.priceOptionSelected]}
              onPress={() => setSelectedPlan('monthly')}
              data-testid="premium-monthly-option"
            >
              <View style={styles.radioOuter}>
                {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.priceInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.priceLabel}>{t('monthly', 'Monthly')}</Text>
                </View>
                <Text style={styles.priceSub}>{t('monthly_subscription', 'Monthly subscription')}</Text>
              </View>
              <Text style={styles.priceAmount}>{prices.monthly || '—'}</Text>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleSubscribe} disabled={isLoading || !iapReady || !prices[selectedPlan]} data-testid="premium-subscribe-btn">
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>
                {t('subscribe_now', 'Subscribe Now')}
              </Text>
            )}
          </TouchableOpacity>

          {(!iapReady && !loadingProducts) && (
            <TouchableOpacity onPress={() => setProductAttempt(n => n + 1)} testID="premium-retry-prices">
              <Text style={styles.trialInfoText}>{t('retry_store_prices', 'Prices could not be loaded. Tap to retry.')}</Text>
            </TouchableOpacity>
          )}

          {/* The native store sheet is authoritative for offers and renewal terms. */}
          {selectedPlan === 'monthly' && (
            <Text style={styles.trialInfoText}>
              {t('subscription_store_terms', 'The store shows the final price and renewal terms before you confirm.')}
            </Text>
          )}

          {/* Footer */}
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
              <Text style={styles.footerLink}>{t('restore_purchases', 'Restore purchases')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { 
              onClose(); 
              setTimeout(() => router.push('/static-page?type=terms'), 400);
            }}>
              <Text style={styles.footerLink}>{t('terms_conditions', 'Terms & Conditions')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { 
              onClose(); 
              setTimeout(() => router.push('/static-page?type=privacy'), 400);
            }}>
              <Text style={styles.footerLink}>{t('privacy_policy', 'Privacy Policy')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0F' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 }, // paddingBottom dynamically overridden with insets.bottom
  closeBtn: { position: 'absolute', right: 20, zIndex: 100 },
  closeBtnCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  crownSection: { alignItems: 'flex-start', marginBottom: 20 },
  crownBox: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  premiumTitle: { fontSize: 28 * S, fontFamily: 'Ubuntu-Bold', color: '#FFD700', marginBottom: 4 },
  premiumSubtitle: { fontSize: 16 * S, fontFamily: 'Ubuntu-Regular', color: 'rgba(255,255,255,0.7)', marginBottom: 28 },
  featuresList: { marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureCheck: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  featureText: { fontSize: 16 * S, fontFamily: 'Ubuntu-Medium', color: '#FFF', flex: 1 },
  pricingSection: { marginBottom: 24, gap: 12 },
  priceOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceOptionSelected: { borderColor: '#FF4199', backgroundColor: 'rgba(255,65,153,0.08)' },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#FF4199',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF4199' },
  priceInfo: { flex: 1 },
  priceLabel: { fontSize: 16 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  priceSub: { fontSize: 12 * S, fontFamily: 'Ubuntu-Regular', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  priceAmount: { fontSize: 20 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  recommendedBadge: {
    backgroundColor: '#FF4199', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  recommendedText: { fontSize: 10 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  trialBadge: {
    backgroundColor: '#4CAF50', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  trialBadgeText: { fontSize: 10 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  trialInfoText: {
    fontSize: 12 * S, fontFamily: 'Ubuntu-Regular',
    color: 'rgba(255,255,255,0.4)', textAlign: 'center',
    marginTop: -12, marginBottom: 16, paddingHorizontal: 16,
  },
  ctaButton: {
    height: 56, borderRadius: 28, backgroundColor: '#FF4199',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  ctaText: { fontSize: 17 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  footerLinks: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 8, marginBottom: 20,
  },
  footerLink: { fontSize: 13 * S, fontFamily: 'Ubuntu-Regular', color: 'rgba(255,255,255,0.4)', textDecorationLine: 'underline' },
  heroSection: { alignItems: 'center', marginBottom: 24 },
  heroImagePlaceholder: {
    width: SCREEN_WIDTH - 48, height: 200 * S, borderRadius: 20,
    backgroundColor: 'rgba(255,65,153,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  titleSection: { alignItems: 'center', marginBottom: 20 },
  brandName: { fontSize: 22 * S, fontFamily: 'Ubuntu-Bold', color: '#FF4199', marginBottom: 4 },
  removeAdsTitle: { fontSize: 18 * S, fontFamily: 'Ubuntu-Medium', color: 'rgba(255,255,255,0.6)' },
  removeAdsDesc: { fontSize: 22 * S, fontFamily: 'Ubuntu-Bold', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  removeAdsSubDesc: { fontSize: 15 * S, fontFamily: 'Ubuntu-Regular', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 32 },
  removeAdsPriceBox: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', marginBottom: 20,
  },
  removeAdsPriceText: { fontSize: 15 * S, fontFamily: 'Ubuntu-Medium', color: 'rgba(255,255,255,0.7)' },
});

export default PremiumPaywall;

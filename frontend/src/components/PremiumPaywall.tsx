import {previewSafeArea} from '../utils/previewSafeArea';
import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  InteractionManager,
  useWindowDimensions,
  Platform,
  Alert,
  Animated,
  Easing,
  AccessibilityInfo} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePremiumStore } from '../store/premiumStore';
import { useTranslation } from 'react-i18next';
import { StaticPageContent } from './StaticPageContent';


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
}

const PREMIUM_FEATURES = [
  { key: 'remove_ads', icon: 'ban-outline' as const },
  { key: 'unlimited_messaging', icon: 'chatbubbles-outline' as const },
  { key: 'music_connections', icon: 'people-outline' as const },
  { key: 'spotify_youtube', icon: 'logo-youtube' as const },
  { key: 'hd_stream', icon: 'radio-outline' as const },
  { key: 'and_more', icon: 'sparkles-outline' as const },
];

type PricingOption = 'monthly' | 'yearly' | 'quarterly';

export const PremiumPaywall: React.FC<PremiumPaywallProps> = ({ visible, onClose, mode = 'premium' }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const adsScale = viewportWidth / 375;
  const previewTop = previewSafeArea().top;
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | null>(null);
  useEffect(() => { if (!visible) setLegalPage(null); }, [visible]);
  const [selectedPlan, setSelectedPlan] = useState<PricingOption>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [iapReady, setIapReady] = useState(false);

  const [presented, setPresented] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (mode !== 'premium') return;
    if (visible) setPresented(true);
    const animation = Animated.timing(entrance, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? 240 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) setPresented(false); });
    return () => animation.stop();
  }, [visible, mode, entrance, reduceMotion]);
  const paywallVisible = mode === 'premium' ? presented || visible : visible;
  useAnalyticsOverlay(legalPage ? 'legal-'+legalPage : mode === 'premium' ? 'premium' : 'remove-ads', paywallVisible);

  // Keep the development phone frame in sync with a full-screen modal.
  useLayoutEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (show: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: mode === 'remove_ads' ? 'removeAds' : 'premium', visible: show }, 'http://localhost:8082');
      notify(paywallVisible && !legalPage);
      return () => notify(false);
    }
  }, [paywallVisible, mode, legalPage]);

  useEffect(() => {
    if (mode !== 'premium' || legalPage || !paywallVisible || !(__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1')) return;
    const id = entrance.addListener(({ value }) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'premiumProgress', visible: value }, 'http://localhost:8082'));
    return () => entrance.removeListener(id);
  }, [entrance, mode, paywallVisible, legalPage]);

  // Initialize IAP and load real prices
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    let active = true;
    const initIAP = async () => {
      const iap = getIAPService();
      if (!iap) return;

      try {
        await iap.initialize();
        const products = iap.getProducts();
        const PIDS = getProductIds();

        const priceMap: Record<string, string> = {};
        products.forEach((p: any) => {
          if (p.productId === PIDS.REMOVE_ADS_YEARLY) priceMap.remove_ads = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_MONTHLY) priceMap.monthly = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_YEARLY) priceMap.yearly = p.localizedPrice;
          if (p.productId === PIDS.PREMIUM_QUARTERLY) priceMap.quarterly = p.localizedPrice;
        });

        if (!active) return;
        setPrices(priceMap);
        setIapReady(products.length > 0);
        console.log('[Paywall] Loaded prices:', priceMap, 'products:', products.length);
      } catch (e) {
        console.log('[Paywall] IAP init error (expected on simulator):', e);
      }
    };

    // Let the modal's initial frame paint before loading the native store bridge.
    const task = InteractionManager.runAfterInteractions(() => { void initIAP(); });
    return () => { active = false; task.cancel(); };
  }, [visible]);

  const handleSubscribe = useCallback(async () => {
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
          case 'quarterly':
            productId = PIDS.PREMIUM_QUARTERLY;
            break;
          default:
            productId = PIDS.PREMIUM_YEARLY;
        }
      }

      console.log('[Paywall] Purchasing:', productId);

      // Check if IAP is actually connected before attempting purchase
      if (!iap.isAvailable()) {
        Alert.alert(
          t('not_available', 'Not Available'),
          t('iap_not_connected', 'Store connection is not ready. Please try again in a moment.'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Never purchase a fallback price or substitute another plan when the store product is absent.
      if (!iap.getProduct(productId)) {
        Alert.alert(t('not_available', 'Not Available'), t('iap_product_unavailable', 'This plan is not available in the store yet. Please try again later.'));
        return;
      }

      const result = await iap.purchaseSubscription(productId);

      // If purchase was initiated successfully, close paywall
      // purchaseUpdatedListener in iapService handles the actual success
      if (result) {
        onClose();
      } else {
        Alert.alert(
          t('purchase_error', 'Purchase Error'),
          t('purchase_not_initiated', 'Could not initiate purchase. Please check your store connection and try again.'),
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert(
          t('purchase_error', 'Purchase Error'),
          error.message || t('purchase_failed', 'Purchase could not be completed. Please try again.'),
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [mode, selectedPlan, t, onClose]);

  const handleRestore = useCallback(async () => {
    const iap = getIAPService();
    if (!iap) return;

    setIsLoading(true);
    try {
      const restored = await iap.restorePurchases();
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
      Alert.alert(t('error', 'Error'), error.message);
    } finally {
      setIsLoading(false);
    }
  }, [t, onClose]);

  if (!paywallVisible) return null;

  // ─── Remove Ads Paywall (Simple) ───
  if (mode === 'remove_ads') {
    return (
      <Modal visible={visible} animationType={Platform.OS === 'web' ? 'none' : 'fade'} presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
        <View style={adsStyles.container} testID="remove-ads-paywall-screen">
          <Image source={require('../../assets/images/paywall/remove-ads-hero.png')} style={[adsStyles.hero, { top: -previewTop }]} contentFit="fill" pointerEvents="none" />
          <TouchableOpacity style={[adsStyles.close, { top: 54 * adsScale - previewTop, right: 22 * adsScale, width: 44 * adsScale, height: 44 * adsScale }]} onPress={onClose} testID="remove-ads-close-btn" accessibilityRole="button" accessibilityLabel={t('close', 'Close')} />
          <ScrollView contentContainerStyle={[adsStyles.content, { paddingTop: 282 * adsScale - previewTop, paddingBottom: Math.max(24, insets.bottom + 16) }]} showsVerticalScrollIndicator={false}>
            <View testID="remove-ads-brand" style={adsStyles.brand}>
              <Image source={require('../../assets/images/default-station-logo.png')} style={adsStyles.logo} contentFit="contain" />
              <View><Text style={adsStyles.brandName}>MegaRadio</Text><Text style={adsStyles.brandRemove}>{t('remove_ads_title', 'Remove Ads')}</Text></View>
            </View>
            <Text style={adsStyles.title}>{t('tired_of_ads', 'Tired of seeing ads?')}</Text>
            <Text style={adsStyles.description}>{t('remove_all_ads', 'Now remove all annoying ads')}</Text>
            <View style={adsStyles.priceBox}><Text style={adsStyles.priceText}><Text style={adsStyles.priceBold}>{prices.remove_ads || '€5.99'}/{t('yearly_lc', 'yearly')}</Text>, {t('cancel_anytime', 'cancel anytime')}</Text></View>
            <TouchableOpacity style={adsStyles.cta} onPress={handleSubscribe} disabled={isLoading} testID="remove-ads-subscribe-btn" accessibilityRole="button">
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={adsStyles.ctaText}>{t('remove_ads_btn', 'Remove Ads')}</Text>}
            </TouchableOpacity>
            <View testID="remove-ads-footer" style={adsStyles.footer}>
              <TouchableOpacity onPress={handleRestore}>
                <Text style={adsStyles.footerText}>{t('already_paid', 'Already paid?')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                onClose();
                setTimeout(() => router.push('/static-page?type=terms'), 400);
              }}>
                <Text style={adsStyles.footerText}>{t('terms_conditions', 'Terms & Conditions')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                onClose();
                setTimeout(() => router.push('/static-page?type=privacy'), 400);
              }}>
                <Text style={adsStyles.footerText}>{t('privacy_policy', 'Privacy Policy')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Final App / premium-paywall: 93WU6qa5fB9HBxkXXsc9WV, 1:2210.
  const plans = [
    { key: 'yearly' as const, label: t('premium_yearly_label', 'Yearly'), price: prices.yearly || '€29.99', note: t('cancel_anytime', 'cancel anytime') },
    { key: 'quarterly' as const, label: t('premium_quarterly', '3 months'), price: prices.quarterly || '€9.99', note: t('cancel_anytime', 'cancel anytime') },
    { key: 'monthly' as const, label: t('premium_monthly_label', 'Monthly'), price: prices.monthly || '€3.99', note: t('cancel_anytime', 'cancel anytime') },
  ];
  return <Modal visible={paywallVisible} animationType="none" transparent onRequestClose={() => legalPage ? setLegalPage(null) : onClose()}>
    {legalPage ? <StaticPageContent key={legalPage} miniPlayerOverlay={false} type={legalPage} onBack={() => setLegalPage(null)} /> : <Animated.View style={[paywallStyles.container, { opacity: entrance }]} testID="premium-paywall-screen">
      <Image source={require('../../assets/images/paywall/hero.svg')} style={[paywallStyles.hero, { top: -previewTop, height: 320 + previewTop }]} contentFit="cover" contentPosition="top right" />
      <LinearGradient colors={['rgba(19,19,19,0.05)', 'rgba(19,19,19,0.4)', '#131313']} locations={[0, 0.4, 1]} style={[paywallStyles.heroFade, { top: -previewTop, height: 320 + previewTop }]} pointerEvents="none" />
      <TouchableOpacity style={[paywallStyles.close, { top: insets.top + 16 }]} onPress={onClose} testID="premium-close-btn" accessibilityRole="button" accessibilityLabel={t('close', 'Close')}><Ionicons name="close" size={22} color="#FFFFFF" /></TouchableOpacity>
      <ScrollView contentContainerStyle={[paywallStyles.content, { paddingTop: insets.top + 91, paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={paywallStyles.brand}>
          <Image source={require('../../assets/images/home/premium.svg')} style={paywallStyles.logo} contentFit="contain" />
          <View><Text style={paywallStyles.brandName}>MegaRadio</Text><Text style={paywallStyles.brandPremium}>Premium</Text></View>
        </View>
        <View style={paywallStyles.features}>
          {PREMIUM_FEATURES.map(feature => <View key={feature.key} style={paywallStyles.feature}>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={paywallStyles.featureText} numberOfLines={feature.key === 'music_connections' ? 1 : undefined}>
              {feature.key === 'remove_ads' && t('feat_remove_ads', 'Remove Ads')}
              {feature.key === 'unlimited_messaging' && t('feat_unlimited_messaging', 'Unlimited Messaging')}
              {feature.key === 'music_connections' && t('feat_music_connections', 'Meet through music, connect through chat.')}
              {feature.key === 'spotify_youtube' && t('feat_spotify_youtube', 'Spotify & YouTube Music Support')}
              {feature.key === 'hd_stream' && t('feat_hd_stream', 'HD Stream')}
              {feature.key === 'and_more' && t('feat_and_more', 'And More...')}
            </Text>
          </View>)}
        </View>
        <View style={paywallStyles.plans} accessibilityRole="radiogroup">
          {plans.map(plan => <TouchableOpacity key={plan.key} testID={`premium-${plan.key}-option`} accessibilityRole="radio" aria-checked={selectedPlan === plan.key} accessibilityState={{ checked: selectedPlan === plan.key, disabled: isLoading }} disabled={isLoading} onPress={() => setSelectedPlan(plan.key)} style={[paywallStyles.plan, selectedPlan === plan.key && paywallStyles.selected]}>
            <View style={paywallStyles.radio}>{selectedPlan === plan.key && <View style={paywallStyles.radioDot} />}</View>
            <Text style={paywallStyles.planCopy}><Text style={paywallStyles.planPrice}>{plan.price}/{plan.label.toLocaleLowerCase()}</Text><Text style={paywallStyles.planNote}>, {plan.note}</Text></Text>
          </TouchableOpacity>)}
        </View>
        {selectedPlan === 'monthly' && <Text style={paywallStyles.trial}>{t('trial_info', '7 days free, then auto-renews at €3.99/month. Cancel anytime.')}</Text>}
        <TouchableOpacity style={paywallStyles.cta} onPress={handleSubscribe} disabled={isLoading} testID="premium-subscribe-btn" accessibilityRole="button">
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={paywallStyles.ctaText}>{selectedPlan === 'monthly' ? t('start_free_trial', 'Start Free Trial') : t('subscribe_now', 'Subscribe Now')}</Text>}
        </TouchableOpacity>
        <View style={paywallStyles.footer}>
          <TouchableOpacity testID="premium-terms-link" accessibilityRole="button" onPress={() => setLegalPage('terms')}><Text style={paywallStyles.footerText}>{t('terms_conditions', 'Terms & Conditions')}</Text></TouchableOpacity>
          <TouchableOpacity testID="premium-privacy-link" accessibilityRole="button" onPress={() => setLegalPage('privacy')}><Text style={paywallStyles.footerText}>{t('privacy_policy', 'Privacy Policy')}</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>}
  </Modal>;
};

const paywallStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  hero: { position: 'absolute', top: 0, right: 0, width: '100%', height: 320 },
  heroFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  close: { outlineWidth: 0, position: 'absolute', right: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(65,65,65,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  content: { paddingHorizontal: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  logo: { width: 50, height: 50, borderRadius: 10 },
  brandName: { fontFamily: 'Ubuntu-Bold', fontSize: 16, color: '#FFFFFF' },
  brandPremium: { fontFamily: 'Ubuntu-Bold', fontSize: 16, color: '#FFD146' },
  features: { marginBottom: 24 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  featureText: { flex: 1, color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 20 },
  plans: { gap: 10, marginBottom: 24 },
  plan: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 5 },
  selected: { backgroundColor: '#3D3D3D' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#EA4A98', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#EA4A98' },
  planCopy: { flex: 1, fontSize: 16, lineHeight: 20 },
  planPrice: { fontFamily: 'Ubuntu-Bold', color: '#FFFFFF' },
  planNote: { fontFamily: 'Ubuntu-Medium', color: '#B8B8B8' },
  trial: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 18, color: '#BBBBBB', marginBottom: 16 },
  cta: { minHeight: 54, borderRadius: 5, backgroundColor: '#EA4A98', alignItems: 'center', justifyContent: 'center', padding: 12 },
  ctaText: { fontFamily: 'Ubuntu-Bold', fontSize: 16, color: '#FFFFFF' },
  footer: { alignItems: 'center', gap: 12, marginTop: 32 },
  footerText: { fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 16, color: '#767676' },
});

// Verified Figma App / remove-ads-paywall / 2414:8941 (375 × 812); existing hero asset.
const adsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131313' },
  hero: { position: 'absolute', top: 0, width: '100%', aspectRatio: 375 / 436 },
  close: { outlineWidth: 0, position: 'absolute', top: 54, right: 22, width: 44, height: 44, zIndex: 10 },
  content: { paddingTop: 282, paddingHorizontal: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
  logo: { width: 50, height: 50, borderRadius: 10 },
  brandName: { fontFamily: 'Ubuntu-Bold', fontSize: 16, lineHeight: 20, color: '#FFFFFF' },
  brandRemove: { fontFamily: 'Ubuntu-Bold', fontSize: 16, lineHeight: 20, color: '#FFD146' },
  title: { fontFamily: 'Ubuntu-Bold', fontSize: 24, lineHeight: 28, color: '#FFFFFF' },
  description: { fontFamily: 'Ubuntu-Medium', fontSize: 20, lineHeight: 23, color: '#B8B8B8', marginBottom: 28 },
  priceBox: { minHeight: 64, backgroundColor: '#393939', borderRadius: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginBottom: 22 },
  priceText: { fontFamily: 'Ubuntu-Medium', fontSize: 16, lineHeight: 20, color: '#B8B8B8', textAlign: 'center' },
  priceBold: { fontFamily: 'Ubuntu-Bold', color: '#FFFFFF' },
  cta: { minHeight: 54, padding: 12, borderRadius: 5, backgroundColor: '#EA4A98', alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: 'Ubuntu-Bold', fontSize: 16, color: '#FFFFFF' },
  footer: { marginTop: 128, alignItems: 'center', gap: 12 },
  footerText: { fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 16, color: '#767676' },
});

export default PremiumPaywall;

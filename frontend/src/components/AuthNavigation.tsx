import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Figma email login1831:5829 / forgot2005:6162: arrow24×24 at41,72.
 * Keep the header outside keyboard/scroll containers, with a44px touch target.
 */
export function AuthNavigation({ fallback, testID }: { fallback: '/auth-options' | '/login'; testID: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = width / 375;
  useEffect(() => {
    if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY !== '1') return;
    window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'authFrame', visible: true }, 'http://localhost:8082');
    return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'authFrame', visible: false }, 'http://localhost:8082');
  }, []);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <StatusBar style="light" translucent backgroundColor="transparent" />
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t('back', 'Geri')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace(fallback); }}
      style={{ position: 'absolute', left: 41 * scale - 10,
        top: Math.max(72 * scale, insets.top + 12) - 10, width: 44, height: 44,
        alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('../../assets/images/profile/arrow-left.svg')} tintColor="#FFFFFF" contentFit="contain" style={{ width: 24, height: 24 }} />
    </Pressable>
  </View>;
}

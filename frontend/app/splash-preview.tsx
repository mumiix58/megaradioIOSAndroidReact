import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { BrandSplash } from '../src/components/BrandSplash';

/** Hold the real branded opening on screen for design review. */
export default function SplashPreview() {
  if (!__DEV__ || Platform.OS !== 'web' || process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY !== '1') return <Redirect href="/" />;
  const flow = new URLSearchParams(window.location.search).get('flow') === '1';
  return <View style={styles.screen}><BrandSplash hold={!flow} ready={flow}
    onComplete={() => router.replace('/onboarding?preview=1')} /></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#1B1C1E' } });

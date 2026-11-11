import {previewSafeArea} from '../utils/previewSafeArea';
import {MegaLoadingState} from './MegaLoadingState';
import React, { useCallback, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AppPage } from '../services/appService';

const HERO = require('../../assets/images/about-hero.png');
const LOGO = require('../../assets/images/about/logo.svg');
const PREVIEW = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1';
const FALLBACK = [
  'MegaRadio is your gateway to thousands of radio stations from around the world. Discover new music, stay updated with news, and enjoy your favorite genres - all in one app.',
  'With MegaRadio, you can explore stations by genre, location, or popularity. Save your favorites and connect with other music lovers.',
];

export function AboutUsScreen({ page, loading, onBack }: { page: AppPage | null; loading: boolean; onBack: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const contentWidth = Math.min(width, 600);
  const scale = contentWidth / 375;
  const previewTop = previewSafeArea().top;
  const imageHeight = 426 * scale;
  const heroHeight = imageHeight - previewTop;
  const headerHeight = insets.top + 78;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, Math.max(1, heroHeight - headerHeight)], outputRange: [0, 1], extrapolate: 'clamp' });
  const paragraphs = page?.content?.trim() ? page.content.trim().split(/\n\s*\n/) : FALLBACK;
  const notifyPreview = useCallback((visible: boolean, y = 0) => {
    if (PREVIEW) window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'about', visible, scrollY: y }, 'http://localhost:8082');
  }, []);
  useFocusEffect(useCallback(() => {
    notifyPreview(true);
    return () => notifyPreview(false);
  }, [notifyPreview]));

  return <View style={styles.screen}>
    <Animated.ScrollView testID="about-scroll" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true, listener: event => notifyPreview(true, (event as { nativeEvent: { contentOffset: { y: number } } }).nativeEvent.contentOffset.y) })}>
      <View style={[styles.column, { width: contentWidth }]}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={HERO} style={{ position: 'absolute', top: -previewTop, width: contentWidth, height: imageHeight }} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(0,0,0,0)', '#1B1C1E']} style={[styles.fade, { height: 118 * scale }]} />
          <View style={[styles.logo, { top: 213 * scale - previewTop, height: 70 * scale }]}>
            <Image source={LOGO} style={{ width: 202, height: 70, transform: [{ scale }] }} contentFit="contain" accessibilityLabel="MegaRadio" />
          </View>
        </View>
        <View style={styles.copy}>
          {loading && !paragraphs.length ? <MegaLoadingState variant="text" count={4} inset={0}/> : paragraphs.map((paragraph, index) => <Text key={index} style={styles.paragraph}>{paragraph}</Text>)}
        </View>
      </View>
    </Animated.ScrollView>
    <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.headerFill, { opacity: headerOpacity }]} />
      <View style={[styles.headerRow, { width: contentWidth }]}>
        <TouchableOpacity onPress={onBack} style={styles.back} testID="about-back-btn" accessibilityRole="button" accessibilityLabel={t('back', 'Back')}>
          <Image source={require('../../assets/images/language/back.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.title}>MegaRadio</Text><View style={styles.back} />
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  column: { alignSelf: 'center' },
  hero: { position: 'relative', overflow: 'hidden' },
  fade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  copy: { paddingHorizontal: 15, paddingTop: 25 },
  paragraph: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 14, lineHeight: 25, letterSpacing: -0.5, marginBottom: 25 },
  header: { position: 'absolute', left: 0, top: 0, right: 0, alignItems: 'center' },
  headerFill: { backgroundColor: '#1B1C1E' },
  headerRow: { height: 78, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21 },
});

import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFavoritesStore } from '../store/favoritesStore';
import { DeezerIcon } from './DeezerIcon';
import type { Station } from '../types';

interface PlayerOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  station: Station | null;
  trackAvailable?: boolean;
  unavailableMessage?: string;
  onSpotify: () => void;
  onYoutube: () => void;
  onAppleMusic: () => void;
  onSoundcloud: () => void;
  onDeezer: () => void;
  onShare: () => void;
  onAirplay?: () => void;
}

// Others / parts / action-sheet 417:2337, with Preview and Equalizer omitted.
export const PlayerOptionsSheet = ({ visible, onClose, station, onSpotify, onYoutube, onAppleMusic, onSoundcloud, onDeezer, onShare, onAirplay, trackAvailable = true, unavailableMessage }: PlayerOptionsSheetProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(579 + (onAirplay ? 64 : 0) + insets.bottom, height - insets.top - 24);
  const progress = useRef(new Animated.Value(0)).current;
  const [presented, setPresented] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const [saving, setSaving] = useState(false);
  const favorite = station ? isFavorite(station._id) : false;
  const mounted = visible || presented;
  useAnalyticsOverlay('player-options',mounted);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useLayoutEffect(() => {
    if (visible) setPresented(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 300 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) {
        setPresented(false);
        const action = pendingAction.current;
        pendingAction.current = null;
        action?.();
      }
    });
    return () => animation.stop();
  }, [visible, progress, reduceMotion]);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'more', visible: mounted }, 'http://localhost:8082');
    }
  }, [mounted]);
  useEffect(() => {
    if (!mounted || !(__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1')) return;
    const id = progress.addListener(({ value }) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'moreProgress', visible: value }, 'http://localhost:8082'));
    return () => progress.removeListener(id);
  }, [mounted, progress]);
  const runAfterClose = (action: () => void) => { pendingAction.current = action; onClose(); };
  const toggleFavorite = async () => {
    if (!station || saving) return;
    setSaving(true);
    try {
      if (favorite) await removeFavorite(station._id);
      else await addFavorite(station);
      onClose();
    } finally { setSaving(false); }
  };
  if (!station || !mounted) return null;
  return <Modal visible transparent animationType="none" onRequestClose={onClose} testID="player-options-modal">
    <View style={styles.overlay}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: progress }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="player-options-dismiss" accessibilityRole="button" accessibilityLabel={t('close', 'Close')} />
      <Animated.View style={[styles.sheet, { height: sheetHeight, paddingBottom: insets.bottom, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight + 24, 0] }) }] }]} testID="player-options-sheet">
        <View style={styles.handleArea}><View style={styles.handle} /></View>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={[styles.row, !trackAvailable && { opacity: 0.4 }]} accessibilityHint={!trackAvailable ? unavailableMessage : undefined} onPress={() => runAfterClose(onSpotify)} testID="player-options-spotify" accessibilityRole="button">
            <Image source={require('../../assets/images/player-options/spotify.svg')} style={styles.socialIcon} contentFit="contain" />
            <Text style={styles.text}>{t('search_on_spotify', 'Search on Spotify')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, !trackAvailable && { opacity: 0.4 }]} accessibilityHint={!trackAvailable ? unavailableMessage : undefined} onPress={() => runAfterClose(onAppleMusic)} testID="player-options-appleMusic" accessibilityRole="button" accessibilityLabel={t('search_on_apple_music', 'Search on Apple Music')}>
            <View style={styles.icon}><Ionicons name="logo-apple" size={30} color="#FFFFFF" accessible={false} /></View>
            <Text style={styles.text}>{t('search_on_apple_music', 'Search on Apple Music')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, !trackAvailable && { opacity: 0.4 }]} accessibilityHint={!trackAvailable ? unavailableMessage : undefined} onPress={() => runAfterClose(onYoutube)} testID="player-options-youtube" accessibilityRole="button">
            <Image source={require('../../assets/images/player-options/youtube.svg')} style={styles.socialIcon} contentFit="contain" />
            <Text style={styles.text}>{t('search_on_youtube', 'Search on YouTube')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, !trackAvailable && { opacity: 0.4 }]} accessibilityHint={!trackAvailable ? unavailableMessage : undefined} onPress={() => runAfterClose(onDeezer)} testID="player-options-deezer" accessibilityRole="button">
            <View style={styles.icon}><DeezerIcon /></View>
            <Text style={styles.text}>{t('search_on_deezer', 'Search on Deezer')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, !trackAvailable && { opacity: 0.4 }]} accessibilityHint={!trackAvailable ? unavailableMessage : undefined} onPress={() => runAfterClose(onSoundcloud)} testID="player-options-soundcloud" accessibilityRole="button">
            <View style={[styles.icon, styles.soundcloudBackground]}><Image source={require('../../assets/images/player/soundcloud-white.webp')} style={styles.soundcloudIcon} contentFit="contain" accessible={false} /></View>
            <Text style={styles.text}>{t('search_on_soundcloud', 'Search on SoundCloud')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={toggleFavorite} disabled={saving} testID="player-options-favorite" accessibilityRole="button" accessibilityState={{ selected: favorite, disabled: saving }}>
            <View style={styles.icon}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Image source={require('../../assets/images/player-options/heart.svg')} style={styles.heartIcon} contentFit="contain" tintColor={favorite ? '#FF4199' : '#FFFFFF'} />}</View>
            <Text style={styles.text}>{favorite ? t('remove_from_favorites', 'Remove from Favorites') : t('add_this_to_favorites', 'Add This to Favorites')}</Text>
          </TouchableOpacity>
          {onAirplay && <TouchableOpacity style={styles.row} onPress={() => runAfterClose(onAirplay)} testID="player-options-airplay" accessibilityRole="button">
            <View style={styles.icon}><Image source={require('../../assets/images/player/mirroring-screen.svg')} style={{ width: 24, height: 24 }} contentFit="contain" /></View>
            <Text style={styles.text}>AirPlay</Text>
          </TouchableOpacity>}
          <TouchableOpacity style={styles.row} onPress={() => runAfterClose(onShare)} testID="player-options-share" accessibilityRole="button">
            <View style={styles.icon}><Image source={require('../../assets/images/player-options/share.svg')} style={styles.shareIcon} contentFit="contain" /></View>
            <Text style={styles.text}>{t('share', 'Share')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
};
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#000000', borderTopLeftRadius: 10.981, borderTopRightRadius: 10.981, overflow: 'hidden' },
  handleArea: { height: 48, alignItems: 'center', paddingTop: 21.962 },
  handle: { width: 54.904, height: 6.588, backgroundColor: '#676767', borderRadius: 4.392 },
  list: { paddingHorizontal: 16.471, paddingTop: 5.257, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 66.983, gap: 15.373 },
  socialIcon: { width: 39.5309, height: 39.5309 },
  icon: { width: 39.531, height: 39.531, borderRadius: 31.844, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  soundcloudBackground: { backgroundColor: '#121212' },
  soundcloudIcon: { width: 52, height: 50 },
  heartIcon: { width: 24.1578, height: 24.1578, transform: [{ translateY: 1.0065 }] },
  shareIcon: { width: 21.9616, height: 21.9616 },
  text: { fontFamily: 'Ubuntu-Bold', fontSize: 15.373, lineHeight: 21.962, letterSpacing: -0.549, color: '#FFFFFF', flexShrink: 1 },
});
export default PlayerOptionsSheet;

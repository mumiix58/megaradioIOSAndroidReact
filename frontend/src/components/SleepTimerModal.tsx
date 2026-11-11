import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ImageWithFallback } from './ImageWithFallback';
import { PlayerEqualizer } from './PlayerEqualizer';
import { formatSleepTime, sleepPickerIndex } from '../utils/sleepTimer';

const ITEM_H = 60;
const PICKER_H = 300;
const PAD = (PICKER_H - ITEM_H) / 2;

function NumberPicker({ max, value, onChange, suffix, label, itemHeight = ITEM_H, density = 1 }: { max: number; value: number; onChange: (value: number) => void; suffix: string; label: string; itemHeight?: number; density?: number }) {
  const scroll = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialValue = useRef(value);
  const [ready, setReady] = useState(false);
  const initialize = () => {
    if (initialized.current || !scroll.current) return;
    initialized.current = true;
    scroll.current.scrollTo({ y: initialValue.current * itemHeight, animated: false });
    setReady(true);
  };
  const select = useCallback((next: number, animated = true) => {
    if (settle.current) clearTimeout(settle.current);
    onChange(next);
    scroll.current?.scrollTo({ y: next * itemHeight, animated });
  }, [onChange, itemHeight]);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!initialized.current) return;
    const next = sleepPickerIndex(event.nativeEvent.contentOffset.y, itemHeight, max);
    onChange(next);
    if (settle.current) clearTimeout(settle.current);
    // Web does not reliably send momentum-end for mouse/trackpad scrolling.
    settle.current = setTimeout(() => select(next), 140);
  };
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  useEffect(() => {
    if (settle.current) clearTimeout(settle.current);
    if (initialized.current) scroll.current?.scrollTo({ y: value * itemHeight, animated: false });
  }, [itemHeight]);
  return <View style={[s.wheel, { height: itemHeight * 5 }]}>
    <ScrollView ref={scroll} testID={`sleep-picker-${suffix}`} onContentSizeChange={initialize}
      showsVerticalScrollIndicator={false} bounces={false} snapToInterval={itemHeight}
      decelerationRate="fast" scrollEventThrottle={16} onScroll={onScroll}
      onMomentumScrollEnd={event => select(sleepPickerIndex(event.nativeEvent.contentOffset.y, itemHeight, max))}
      contentContainerStyle={{ paddingVertical: itemHeight * 2 }} style={{ opacity: ready ? 1 : 0 }}>
      {Array.from({ length: max + 1 }, (_, num) => <Pressable key={num} onPress={() => select(num)}
        accessibilityRole="button" accessibilityLabel={`${num} ${label}`} accessibilityState={{ selected: value === num }}
        testID={`sleep-${suffix}-${num}`} style={[s.numberRow, { height: itemHeight }]}>
        <Text style={[s.number, { fontSize: 36 * density, lineHeight: 44 * density, color: num === value ? '#FFFFFF' : Math.abs(num - value) === 1 ? '#888888' : '#333333' }]}>{num}</Text>
        {num === value && <Text style={[s.suffix, { fontSize: Math.max(11, 14 * density), marginTop: 16 * density }]}>{suffix}</Text>}
      </Pressable>)}
    </ScrollView>
  </View>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onStart: (minutes: number) => void;
  isTimerActive: boolean;
  remainingSeconds: number;
  onCancel: () => void;
  stationName: string;
  logoUrl: string | null;
  fallbackLogoUrl?: string;
  trackTitle: string;
  trackArtist: string;
  playing: boolean;
  favorite: boolean;
  onFavorite: () => void;
  onMore: () => void;
  previewTopInset?: number;
}

/** Figma alarm312:601 / action-sheet312:606, counter1677:4600. */
export function SleepTimerModal({ visible, onClose, onStart, isTimerActive, remainingSeconds, onCancel,
  stationName, logoUrl, fallbackLogoUrl, trackTitle, trackArtist, playing, favorite, onFavorite, onMore, previewTopInset = 0 }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const scale = Math.max(1, Math.min(width / 375, 1.2));
  const [presented, setPresented] = useState(visible);
  const [counterMode, setCounterMode] = useState(isTimerActive);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(30);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const wasActive = useRef(isTimerActive);
  const progress = useRef(new Animated.Value(0)).current;
  const mounted = visible || presented;
  useAnalyticsOverlay('sleep-timer',mounted);
  const sheetHeight = Math.min(542 * scale, Math.max(300, height - insets.top - 210));
  const compactGap = Math.max(16, (height - sheetHeight - insets.top - 60 - 104) / 2);
  const density = Math.min(1, sheetHeight / 542);
  const itemHeight = ITEM_H * density;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  useLayoutEffect(() => { if (visible) { setCounterMode(isTimerActive); setPresented(true); } }, [visible]);
  useEffect(() => {
    if (visible && wasActive.current && !isTimerActive) onClose();
    wasActive.current = isTimerActive;
  }, [visible, isTimerActive, onClose]);
  useEffect(() => {
    if (!mounted) return;
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduceMotion ? 0 : visible ? 280 : 180,
      easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished && !visible) { setPresented(false); const action = pendingAction.current; pendingAction.current = null; action?.(); }
    });
    return () => animation.stop();
  }, [visible, mounted, reduceMotion, progress]);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'sleepTimer', visible: mounted }, 'http://localhost:8082');
      return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'sleepTimer', visible: false }, 'http://localhost:8082');
    }
  }, [mounted]);
  const closeThen = (action?: () => void) => { pendingAction.current = action || null; onClose(); };
  if (!mounted) return null;
  return <Modal visible transparent presentationStyle="overFullScreen" statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => closeThen()} testID="sleep-timer-modal">
    <View style={s.scene} testID="sleep-timer-scene">
      <Image source={require('../../assets/images/player/background-glow.svg')} style={[s.glow, { top: -172 - previewTopInset }]} contentFit="fill" accessible={false} />
      <Animated.View testID="sleep-header-shade" pointerEvents="none" style={[s.compactHeaderShade, { height: insets.top + 60, opacity: Animated.multiply(progress, 0.65) }]} />
      <Animated.View style={[s.compactScene, { paddingTop: insets.top, opacity: Animated.multiply(progress, 0.65) }]} testID="sleep-compact-player">
        <View style={s.compactHeader}>
          <Pressable onPress={() => closeThen()} accessibilityRole="button" accessibilityLabel={t('sleep_timer_close', 'Close')} style={s.iconButton}>
            <Image source={require('../../assets/images/player/collapse.svg')} style={s.icon} contentFit="contain" />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>{stationName}</Text>
          <Pressable onPress={onFavorite} accessibilityRole="button" accessibilityLabel={t(favorite ? 'remove_from_favorites' : 'add_to_favorites', favorite ? 'Remove from favorites' : 'Add to favorites')} style={s.iconButton}>
            <Image source={favorite ? require('../../assets/images/player/heart-filled.svg') : require('../../assets/images/player/heart.svg')} tintColor={favorite ? '#FF4199' : '#FFFFFF'} style={s.icon} contentFit="contain" />
          </Pressable>
        </View>
        <View style={[s.trackRow, { marginTop: compactGap }]}>
          <ImageWithFallback uri={logoUrl} fallbackUri={fallbackLogoUrl} testID="sleep-track-logo" style={s.trackLogo} contentFit="contain" />
          <View style={s.trackCopy}>
            <View testID="sleep-track-equalizer" style={s.trackEqualizer}><PlayerEqualizer playing={playing} color="#5B9D4C" scale={0.65} /></View>
            <Text testID="sleep-track-title" style={s.trackTitle} numberOfLines={1}>{trackTitle}</Text>
            <Text testID="sleep-track-artist" style={s.trackArtist} numberOfLines={1}>{trackArtist}</Text>
          </View>
          <Pressable style={s.iconButton} onPress={() => closeThen(onMore)} accessibilityRole="button" accessibilityLabel={t('more', 'More')}>
            <Image source={require('../../assets/images/player/more.svg')} style={s.moreIcon} contentFit="contain" />
          </Pressable>
        </View>
      </Animated.View>
      <Animated.View testID="sleep-timer-sheet" style={[s.sheet, { height: sheetHeight, paddingBottom: insets.bottom,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }) }] }]}>
        <View style={s.sheetHeader}>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('sleep_counter_title', 'Sleep Counter')}</Text>
          <Pressable onPress={() => closeThen()} accessibilityRole="button" accessibilityLabel={t('sleep_timer_close', 'Close')} testID="sleep-timer-close" style={s.close}>
            <Text style={s.closeText}>{t('sleep_timer_close', 'Close')}</Text>
          </Pressable>
        </View>
        {counterMode ? <View style={[s.counter, { top: 185 * density }]}>
          <Text style={s.counterLabel}>{t('sleep_timer_explanation', 'The radio will stop automatically when this timer ends.')}</Text>
          <Text style={[s.counterTime, { fontSize: Math.max(28, 36 * density) }]} testID="sleep-counter-time">{formatSleepTime(remainingSeconds)}</Text>
        </View> : <View style={[s.pickerArea, { top: 80 * density, height: itemHeight * 5 }]}>
          <View style={[s.selectionBand, { top: itemHeight * 2, height: itemHeight }]} pointerEvents="none" />
          <View style={[s.pickerColumns, { height: itemHeight * 5 }]}>
            <NumberPicker itemHeight={itemHeight} density={density} max={23} value={hour} onChange={setHour} suffix="h" label={t('sleep_timer_hours', 'hours')} />
            <NumberPicker itemHeight={itemHeight} density={density} max={59} value={minute} onChange={setMinute} suffix="m" label={t('sleep_timer_minutes', 'minutes')} />
          </View>
        </View>}
        <View style={[s.buttonArea, { bottom: Math.max(63 * density, insets.bottom + 16) }]}>
          <Pressable testID={counterMode ? 'sleep-counter-stop' : 'sleep-timer-start'} accessibilityRole="button"
            accessibilityLabel={counterMode ? t('sleep_timer_stop', 'Stop') : t('sleep_timer_start', 'Start')}
            disabled={!counterMode && hour === 0 && minute === 0}
            onPress={() => counterMode ? closeThen(onCancel) : closeThen(() => onStart(hour * 60 + minute))}
            style={[s.pinkButton, { height: Math.max(44, 50 * density) }, !counterMode && hour === 0 && minute === 0 && { opacity: 0.4 }]}>
            <Text style={s.buttonText}>{counterMode ? t('sleep_timer_stop', 'Stop') : t('sleep_timer_start', 'Start')}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  scene: { flex: 1, backgroundColor: '#131313', overflow: 'hidden' },
  glow: { position: 'absolute', width: 844, height: 844, left: -234 },
  compactHeaderShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.135)' },
  compactScene: { opacity: 0.65 },
  compactHeader: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  icon: { width: 24, height: 24 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'Ubuntu-Bold', fontSize: 20, color: '#FFFFFF' },
  trackRow: { marginTop: 23, marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 20 },
  trackLogo: { width: 104, height: 104, borderRadius: 5 },
  trackCopy: { flex: 1, minWidth: 0 },
  trackEqualizer: { alignSelf: 'flex-start', marginBottom: 1 },
  trackTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Ubuntu-Medium', lineHeight: 23 },
  trackArtist: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Ubuntu-Medium', lineHeight: 20 },
  moreIcon: { width: 24, height: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#000000', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetHeader: { height: 64, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20, paddingHorizontal: 70 },
  title: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 22 },
  close: { position: 'absolute', right: 6, top: 9, minWidth: 60, height: 44, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 22 },
  pickerArea: { position: 'absolute', top: 80, left: 0, right: 0, height: PICKER_H },
  selectionBand: { position: 'absolute', top: PAD, height: ITEM_H, left: 0, right: 0, backgroundColor: '#101010' },
  pickerColumns: { width: 144, alignSelf: 'center', flexDirection: 'row', height: PICKER_H },
  wheel: { flex: 1, height: PICKER_H, overflow: 'hidden' },
  numberRow: { height: ITEM_H, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  number: { fontSize: 36, lineHeight: 44, fontFamily: 'Ubuntu-Bold', textAlign: 'center' },
  suffix: { fontSize: 14, lineHeight: 20, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', marginTop: 16 },
  buttonArea: { position: 'absolute', bottom: 63, left: 0, right: 0, alignItems: 'center' },
  pinkButton: { width: 166, height: 50, borderRadius: 30, backgroundColor: '#FF4199', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18 },
  counter: { position: 'absolute', top: 185, left: 30, right: 30, alignItems: 'center' },
  counterLabel: { color: '#888888', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 16, textAlign: 'center', maxWidth: 240 },
  counterTime: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 36, lineHeight: 44, marginTop: 17, fontVariant: ['tabular-nums'] },
});

export default SleepTimerModal;

import {useAnalyticsOverlay} from '../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePremiumStore } from '../store/premiumStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LogoShadow } from './LogoShadow';
import { useLogoAccent } from '../hooks/useLogoAccent';
import { currentTrackText } from '../utils/nowPlaying';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getStationLogoUrl } from '../utils/stationLogoHelper';
import { useCarCarousel } from '../hooks/useCarCarousel';
import { carouselDelta } from '../utils/carCarousel';
import { GestureDetector } from 'react-native-gesture-handler';
import { CarCarouselCard } from './CarCarouselCard';
import { useCarRadioFeed } from '../hooks/useCarRadioFeed';
import {StationCountryBadge} from './StationCountryBadge';
import { WorldRadioDial } from './WorldRadioDial';
import { rememberWorldRadio } from '../services/worldRadioHistory';
import type { Station } from '../types';

interface CarModeScreenProps {
  visible: boolean;
  onClose: () => void;
  stations: Station[];
  previewStation?: Station | null;
  onOpenPremium: () => void;
}
const icons = {
  previous: require('../../assets/images/car-mode/previous.svg'),
  next: require('../../assets/images/car-mode/next.svg'),
  play: require('../../assets/images/mini-player/play.svg'),
  pause: require('../../assets/images/car-mode/pause.svg'),
  volume: require('../../assets/images/car-mode/volume-up.svg'),
  mute: require('../../assets/images/car-mode/volume-cross.svg'),
};


function Equalizer({ playing }: { playing: boolean }) {
  const values = useRef([new Animated.Value(12), new Animated.Value(20), new Animated.Value(15)]).current;
  useEffect(() => {
    if (!playing) return;
    const loops = values.map((value, i) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 8 + i * 5, duration: 280 + i * 80, useNativeDriver: false }),
      Animated.timing(value, { toValue: 20 - i * 3, duration: 350 + i * 60, useNativeDriver: false }),
    ])));
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [playing, values]);
  return <View style={styles.equalizer}>{values.map((value, i) => <Animated.View key={i} style={[styles.bar, { height: value }]} />)}</View>;
}

export const CarModeScreen = ({ visible, onClose, previewStation, onOpenPremium }: CarModeScreenProps) => {
  const { t } = useTranslation();
  const isPremium = usePremiumStore(state => state.isPremium);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useAnalyticsOverlay('car-mode',visible);
  const scale = Math.min(width / 375, 1.5);
  // Match the 375 × 812 design while fitting shorter screens and landscape.
  const unit = Math.min(scale, (height - insets.top - insets.bottom) / 710);
  const { currentStation, playbackState, nowPlaying } = usePlayerStore();
  const { playStation, togglePlayPause, setVolume } = useAudioPlayer();
  const feed = useCarRadioFeed(visible, currentStation || previewStation);
  const live = useRef(visible); live.current = visible;
  const selection = useRef(0);
  const worldMotion = useSharedValue(0), worldPhase = useSharedValue(0);
  const [dialMoving, setDialMoving] = useState(false);
  const dialRest = useCallback(() => setDialMoving(false), []);
  const worldMotionStyle = useAnimatedStyle(() => ({ transform: [{ translateX: worldMotion.value }] }));
  const [index, setIndex] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const wasVisible = useRef(false);
  const syncedStationId = useRef<string | null>(null);
  const track = useRef<View>(null);
  const geometry = useRef({ x: 0, width: 0 });
  const preview = useCallback((ordinal: number) => { if (feed.center.current !== ordinal) selection.current++; setIndex(ordinal); feed.ensure(ordinal); }, [feed.ensure]);
  const commitStation = useCallback(async (selected: number) => {
    const request = ++selection.current;
    const station = await feed.resolve(selected);
    if (!station || !live.current || request !== selection.current) return;
    rememberWorldRadio(station);
    const current = usePlayerStore.getState();
    syncedStationId.current = station._id;
    if (station._id !== current.currentStation?._id || current.playbackState !== 'playing') {
      void playStation(station, feed.source).catch(error => console.warn('[CarMode] Station change failed', error));
    }
  }, [feed.resolve, feed.source.kind, feed.source.country, playStation]);
  const invalidateSelection = useCallback(() => { selection.current++; }, []);
  const wheel = useCarCarousel({ unit, count: feed.count, infinite: !feed.finite, visible, onInteraction: invalidateSelection, onPreview: preview, onCommit: commitStation });
  const startDial = useCallback(() => { setDialMoving(true); selection.current++; wheel.cancel(); feed.prepareWorld(); }, [wheel.cancel, feed.prepareWorld]);
  const drawWorld = useCallback(async () => {
    const request = ++selection.current; wheel.cancel();
    const station = await feed.world();
    if (!station || !live.current || request !== selection.current || !feed.acceptWorld(station)) return;
    const ordinal = feed.finite ? 0 : feed.center.current;
    wheel.reset(ordinal); setIndex(ordinal); syncedStationId.current = station._id;
    void playStation(station, feed.source).catch(error => console.warn('[CarMode] Discovery playback failed', error));
  }, [feed.world, feed.acceptWorld, feed.finite, feed.source.kind, feed.source.country, wheel.cancel, wheel.reset, playStation]);


  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'car', visible }, 'http://localhost:8082');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      syncedStationId.current = (currentStation || previewStation)?._id || null;
      wheel.reset(0); setIndex(0);
      const currentVolume = usePlayerStore.getState().volume;
      setVolumeState(currentVolume || 1); setMuted(currentVolume === 0);
    } else if (visible && currentStation && currentStation._id !== syncedStationId.current && !wheel.isMoving()) {
      syncedStationId.current = currentStation._id;
      const ordinal = feed.adopt(currentStation); wheel.reset(ordinal); setIndex(ordinal);
    }
    if (!visible) { selection.current++; setDialMoving(false); }
    wasVisible.current = visible;
  }, [visible, currentStation, previewStation, wheel.moving, wheel.reset, wheel.isMoving, feed.adopt]);

  useEffect(() => {
    if (!visible) return;
    const logos = Array.from({ length: 15 }, (_, i) => feed.get(index + i - 7)).filter((s): s is Station => !!s).map(s => getStationLogoUrl(s, 'large')).filter((uri): uri is string => !!uri);
    if (logos.length) void Image.prefetch(logos, { cachePolicy: 'memory-disk' }).catch(() => {});
  }, [visible, index, feed.revision, feed.get]);

  const changeVolume = useCallback((value: number) => {
    setVolumeState(value);
    if (!muted) void setVolume(value);
  }, [muted, setVolume]);
  const volumeGesture = useMemo(() => {
    const update = (pageX: number) => {
      if (geometry.current.width <= 0) return;
      changeVolume(Math.max(0, Math.min(1, (pageX - geometry.current.x) / geometry.current.width)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => update(event.nativeEvent.pageX),
      onPanResponderMove: event => update(event.nativeEvent.pageX),
    });
  }, [changeVolume]);
  const measureTrack = () => track.current?.measureInWindow((x, _y, trackWidth) => { geometry.current = { x, width: trackWidth }; });
  const displayed = feed.get(index) || (index === 0 ? currentStation || previewStation : undefined);
  const logoAccent = useLogoAccent(visible && displayed ? getStationLogoUrl(displayed, 'large') : null);
  if (!visible) return null;

  const playing = displayed?._id === currentStation?._id && playbackState === 'playing';
  const loading = displayed?._id === currentStation?._id && (playbackState === 'loading' || playbackState === 'buffering');
  const song = displayed?._id === currentStation?._id ? currentTrackText(nowPlaying, displayed?.name || '', displayed?.country) : undefined;
  const iconSize = 60 * unit;
  const buttonSize = 100 * unit;

  return <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID="car-mode-screen">
    <View style={[styles.body, { width: 375 * unit }]}>
      <View style={[styles.header, { paddingHorizontal: 15 * unit }]}>
        <Text style={styles.headerTitle}>{t('car_mode', 'Car Mode')}</Text>
        <TouchableOpacity style={styles.close} onPress={onClose} testID="car-mode-close-btn" accessibilityRole="button" accessibilityLabel={t('close', 'Close')}><Text style={styles.closeText}>{t('close', 'Close')}</Text></TouchableOpacity>
      </View>
      <View style={{ height: 90 * unit, justifyContent: 'flex-end', paddingBottom: 6 * unit }}>
        <WorldRadioDial unit={unit} appearance="elastic" showArrows={false} releaseSlots={wheel.slotsCount} motion={worldMotion} phase={worldPhase} onRest={dialRest} onPrepare={feed.prepareWorld} disabled={feed.preparing} busy={feed.drawing} onStart={startDial} onRelease={drawWorld} />
      </View>
      <Reanimated.View testID="car-mode-world-stack" style={[{ height: 174 * unit, marginBottom: -24 * unit, zIndex: 2 }, worldMotionStyle]}>
      <GestureDetector gesture={wheel.gesture} touchAction="pan-y" userSelect="none">
      <View pointerEvents={feed.drawing || feed.preparing || dialMoving ? 'none' : 'auto'} style={[{ height: 150 * unit }, Platform.OS === 'web' && { cursor: wheel.moving ? 'grabbing' : 'grab' } as any]}
        {...(Platform.OS === 'web' ? {
          tabIndex: 0, 'aria-valuemin': feed.finite ? 1 : index - 1, 'aria-valuemax': feed.finite ? feed.count : index + 1, 'aria-valuenow': feed.finite ? index + 1 : index, 'aria-valuetext': displayed?.name,
          onKeyDown: (event: any) => {
            if (feed.drawing || feed.preparing) return;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); invalidateSelection(); wheel.step(event.key === 'ArrowLeft' ? -1 : 1); }
            else if ((event.key === 'Enter' || event.key === ' ') && wheel.isMoving()) { event.preventDefault(); wheel.finishNow(); }
          },
        } : {})}
        accessible accessibilityRole="adjustable" accessibilityLabel={t('radio_stations', 'Radio stations')}
        accessibilityValue={feed.finite ? { min: 1, max: feed.count, now: index + 1, text: displayed?.name } : { text: displayed?.name }}
        accessibilityActions={[{ name: 'increment', label: t('next', 'Next') }, { name: 'decrement', label: t('previous', 'Previous') }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'increment') wheel.step(1); else if (event.nativeEvent.actionName === 'decrement') wheel.step(-1); }}
        testID="car-mode-carousel">
        {logoAccent && <LogoShadow color={logoAccent} scale={unit} />}
        {Array.from({ length: wheel.slotsCount }, (_, slot) => <CarCarouselCard
          key={slot} slot={slot} count={wheel.slotsCount}
          station={(dialMoving||feed.drawing)&&feed.worldCards.length&&Math.round(carouselDelta(slot,index,wheel.slotsCount))!==0
            ? feed.worldCards[((Math.round(carouselDelta(slot,index,wheel.slotsCount))%feed.worldCards.length)+feed.worldCards.length)%feed.worldCards.length]
            : feed.get(index + Math.round(carouselDelta(slot, index, wheel.slotsCount)))} unit={unit} position={wheel.position} phase={worldPhase}
        />)}
      </View>
      </GestureDetector>
      <StationCountryBadge station={displayed} unit={unit} showFlag={false} disabled={!!wheel.moving||dialMoving||feed.drawing||feed.preparing} testID="car-mode-country" style={{left:239*unit,top:126*unit}}/>
      </Reanimated.View>
      <View style={{ marginTop: 26 * unit, alignItems: 'center' }}>
        <Equalizer playing={playing} />
        <Text style={styles.stationName} numberOfLines={1} testID="car-mode-station-name">{feed.drawing ? t('car_world_finding', 'Finding a station…') : displayed?.name || t('loading', 'Loading…')}</Text>
        <Text style={styles.song} numberOfLines={1}>{feed.notice === 'empty' ? t('car_world_unavailable', 'No suitable station found. Try again.') : feed.notice ? t('car_feed_retry', 'Connection interrupted. Try again.') : song || displayed?.genres?.[0] || t('live_radio', 'Live Radio')}</Text>
      </View>
      <View style={[styles.controls, { marginTop: 40 * unit, paddingHorizontal: 15 * unit }]}>
        {(['previous', playing ? 'pause' : 'play', 'next'] as const).map((name, i) => <TouchableOpacity key={i} style={[styles.control, { width: buttonSize, height: buttonSize, borderRadius: 10 * unit }]} testID={['car-mode-prev-btn', 'car-mode-playpause-btn', 'car-mode-next-btn'][i]} accessibilityRole="button" accessibilityLabel={i === 0 ? t('previous', 'Previous') : i === 2 ? t('next', 'Next') : playing ? t('pause', 'Pause') : t('play', 'Play')} onPress={() => { if (feed.drawing || feed.preparing) return; selection.current++; if (i === 0) wheel.step(-1); else if (i === 2) wheel.step(1); else if (wheel.isMoving()) wheel.finishNow(); else if (!displayed || displayed._id !== currentStation?._id) void commitStation(index); else togglePlayPause(); }}>
          {i === 1 && loading ? <ActivityIndicator color="#FFFFFF" /> : <Image source={icons[name]} style={{ width: iconSize, height: iconSize }} contentFit="contain" />}
        </TouchableOpacity>)}
      </View>
      <View style={[styles.volumeRow, { marginTop: 24 * unit, paddingHorizontal: 15 * unit, height: 56 * unit }]}>
        <TouchableOpacity style={[styles.control, { width: buttonSize }]} testID="car-mode-mute-btn" accessibilityRole="button" accessibilityLabel={muted ? t('unmute', 'Unmute') : t('mute', 'Mute')} onPress={() => { setMuted(value => !value); void setVolume(muted ? volume : 0); }}><Image source={muted ? icons.volume : icons.mute} style={{ width: 28, height: 28 }} contentFit="contain" /></TouchableOpacity>
        <View style={styles.volumeBox}>
          <Image source={icons.volume} style={{ width: 24, height: 24 }} contentFit="contain" />
          <View ref={track} onLayout={measureTrack} {...volumeGesture.panHandlers} style={styles.trackArea} testID="car-mode-volume-slider" accessible accessibilityRole="adjustable" accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'increment') changeVolume(Math.min(1, volume + 0.1)); else if (event.nativeEvent.actionName === 'decrement') changeVolume(Math.max(0, volume - 0.1)); }} accessibilityLabel={t('volume', 'Volume')} accessibilityValue={{ min: 0, max: 100, now: Math.round((muted ? 0 : volume) * 100) }}>
            <View style={styles.track}><View style={[styles.fill, { width: `${(muted ? 0 : volume) * 100}%` }]} /></View>
          </View>
        </View>
      </View>
      {!isPremium && <TouchableOpacity style={[styles.premiumBanner, { marginHorizontal: 15 * unit, height: 75 * unit, marginTop: 32 * unit }]} onPress={onOpenPremium} accessibilityRole="button" accessibilityLabel={t('go_premium', 'Go Premium')} testID="car-mode-premium-banner">
        <LinearGradient colors={['#5C27F4', '#9F3FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.premiumGradient}>
          <View style={styles.crownBox}><FontAwesome5 name="crown" size={30} color="#FFD146" /></View>
          <View style={{ flex: 1 }}><Text style={styles.premiumTitle}>{t('go_premium', 'Go Premium')}</Text><Text style={styles.premiumSubtitle}>{t('home_premium_subtitle', 'Unlock amazing features')}</Text></View>
        </LinearGradient>
      </TouchableOpacity>}
    </View>
  </View>;
};
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1B1C1E', zIndex: 1000, alignItems: 'center' },
  body: { flex: 1 },
  premiumBanner: { borderRadius: 10, overflow: 'hidden' },
  premiumGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 15 },
  crownBox: { width: 50, height: 50, borderRadius: 5, backgroundColor: 'rgba(35,13,95,0.45)', justifyContent: 'center', alignItems: 'center' },
  premiumTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  premiumSubtitle: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  header: { height: 54, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 18, color: '#FFFFFF' },
  close: { height: 44, minWidth: 80, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#2F2F2F', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: 'Ubuntu-Bold', fontSize: 15, color: '#FFFFFF' },
  artwork: { width: '100%', height: '100%' },
  equalizer: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 5 },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#FF4199' },
  stationName: { fontFamily: 'Ubuntu-Bold', fontSize: 20, color: '#FFFFFF', paddingHorizontal: 16 },
  song: { fontFamily: 'Ubuntu-Medium', fontSize: 14, color: '#FFFFFF', marginTop: 5, paddingHorizontal: 16 },
  controls: { flexDirection: 'row', justifyContent: 'space-between' },
  control: { height: '100%', backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  volumeRow: { flexDirection: 'row', gap: 19 },
  volumeBox: { flex: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 12, backgroundColor: '#282828', alignItems: 'center', borderRadius: 10 },
  trackArea: { flex: 1, height: '100%', justifyContent: 'center' },
  track: { height: 10, backgroundColor: '#343434', borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#FF4199', borderRadius: 5 },
});

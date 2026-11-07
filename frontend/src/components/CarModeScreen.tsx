import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  PanResponder,
  Animated,
  LayoutChangeEvent,
  ActivityIndicator,
} from 'react-native';
import { ImageWithFallback } from './ImageWithFallback';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../store/playerStore';
import { GlowEffect } from './GlowEffect';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getStationLogoUrl } from '../utils/stationLogoHelper';
import type { Station } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scale factor relative to 375px Figma design
const S = SCREEN_WIDTH / 375;

// EXACT card positions from Figma CSS
// top values are relative: center=0, adjacent=12, far=27 (from Figma top: 187, 199, 214)
const CARD_CONFIGS = [
  { left: 15 * S, top: 27 * S, size: 96 * S, opacity: 0.8, zIndex: 1, radius: 12.12 * S, shadowOpa: 0.05 },
  { left: 50 * S, top: 12 * S, size: 126 * S, opacity: 1.0, zIndex: 5, radius: 12.12 * S, shadowOpa: 0.2 },
  { left: 113 * S, top: 0, size: 150 * S, opacity: 1.0, zIndex: 10, radius: 14.62 * S, shadowOpa: 0.3 },
  { left: 200 * S, top: 12 * S, size: 126 * S, opacity: 1.0, zIndex: 5, radius: 12.12 * S, shadowOpa: 0.2 },
  { left: 264 * S, top: 27 * S, size: 96 * S, opacity: 0.8, zIndex: 1, radius: 12.12 * S, shadowOpa: 0.05 },
];

const CAROUSEL_HEIGHT = 150 * S;

interface CarModeScreenProps {
  visible: boolean;
  onClose: () => void;
  stations: Station[];  // Receive stations from player (no separate fetch)
}

// ─── Custom Carousel ────────────────────────────────────
const StationCarousel = ({
  stations,
  currentIndex,
  onIndexChange,
  getLogoUrl,
}: {
  stations: Station[];
  currentIndex: number;
  onIndexChange: (idx: number) => void;
  getLogoUrl: (s: Station) => string | null;
}) => {
  // Use refs to access latest values in PanResponder callbacks
  const currentIndexRef = useRef(currentIndex);
  const stationsRef = useRef(stations);
  const onIndexChangeRef = useRef(onIndexChange);
  
  // Update refs when props change
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { stationsRef.current = stations; }, [stations]);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 15,
    onPanResponderRelease: (_, { dx, vx }) => {
      const idx = currentIndexRef.current;
      const len = stationsRef.current.length;
      if (len === 0) return;
      if (dx < -40 || vx < -0.5) {
        onIndexChangeRef.current((idx + 1) % len);
      } else if (dx > 40 || vx > 0.5) {
        onIndexChangeRef.current((idx - 1 + len) % len);
      }
    },
  }), []);

  if (stations.length === 0) return null;

  // Calculate which stations to show at each position
  const getStationAtPosition = (positionIndex: number): Station | null => {
    const offset = positionIndex - 2; // -2, -1, 0, 1, 2 for 5 positions
    const stationIndex = ((currentIndex + offset) % stations.length + stations.length) % stations.length;
    return stations[stationIndex] || null;
  };

  return (
    <View style={carouselStyles.container} {...panResponder.panHandlers}>
      {CARD_CONFIGS.map((cfg, posIdx) => {
        const station = getStationAtPosition(posIdx);
        if (!station) return null;

        // Get the logo URL for THIS specific station
        const logoUrl = getLogoUrl(station);
        const isCenter = posIdx === 2;
        
        // Debug log to verify each position gets different station
        // console.log(`[Carousel] Position ${posIdx}: ${station.name} - Logo: ${logoUrl?.substring(0, 50)}`);

        return (
          <View
            key={`carousel-pos-${posIdx}-station-${station._id}`}
            style={[
              carouselStyles.cardOuter,
              {
                left: cfg.left,
                top: cfg.top,
                width: cfg.size,
                height: cfg.size,
                zIndex: cfg.zIndex,
                opacity: cfg.opacity,
                borderRadius: cfg.radius,
              },
              Platform.select({
                ios: {
                  shadowColor: '#7B61FF',
                  shadowOffset: { width: 0, height: isCenter ? 22 * S : 18 * S },
                  shadowOpacity: cfg.shadowOpa,
                  shadowRadius: isCenter ? 42 * S : 34 * S,
                },
                android: {
                  elevation: cfg.zIndex * 2,
                },
                default: {},
              }),
              // Web glow
              Platform.OS === 'web' ? {
                // @ts-ignore
                boxShadow: isCenter
                  ? `0px ${22 * S}px ${82 * S}px ${14 * S}px rgba(123, 97, 255, 0.3)`
                  : posIdx === 1 || posIdx === 3
                    ? `0px ${18 * S}px ${68 * S}px ${12 * S}px rgba(123, 97, 255, 0.2)`
                    : `0px ${18 * S}px ${68 * S}px ${12 * S}px rgba(123, 97, 255, 0.05)`,
              } : {},
            ]}
          >
              <ImageWithFallback
                testID={`car-mode-logo-${posIdx}-${station._id}`}
                uri={logoUrl}
                style={[carouselStyles.cardImage, { borderRadius: cfg.radius }]}
                contentFit="cover"
              />
          </View>
        );
      })}
    </View>
  );
};

const carouselStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  cardOuter: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  placeholderText: {
    fontSize: 40 * S,
    fontFamily: 'Ubuntu-Bold',
    color: '#555',
  },
});

// ─── Volume Slider (Reliable PanResponder-based) ────────────────────────
const VolumeSlider = ({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
}: {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
}) => {
  const sliderWidth = useRef(0);
  const sliderX = useRef(0);
  
  // Create panResponder that calculates position relative to slider
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Calculate volume from initial touch position
        const touchX = evt.nativeEvent.pageX - sliderX.current;
        const newVolume = Math.max(0, Math.min(1, touchX / sliderWidth.current));
        onVolumeChange(newVolume);
      },
      onPanResponderMove: (evt) => {
        // Update volume as user drags
        const touchX = evt.nativeEvent.pageX - sliderX.current;
        const newVolume = Math.max(0, Math.min(1, touchX / sliderWidth.current));
        onVolumeChange(newVolume);
      },
    })
  ).current;
  
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    sliderWidth.current = width;
    // Get absolute position using measure
    event.target.measureInWindow((px) => {
      sliderX.current = px;
    });
  };

  const displayVolume = isMuted ? 0 : volume;
  
  return (
    <View style={volumeStyles.row}>
      <TouchableOpacity 
        style={volumeStyles.muteBtn} 
        onPress={onMuteToggle} 
        testID="car-mode-mute-btn"
      >
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-off'}
          size={28 * S}
          color="#FFF"
        />
      </TouchableOpacity>
      
      <View style={volumeStyles.box}>
        <Ionicons name="volume-high" size={20 * S} color="#FFF" />
        <View 
          style={volumeStyles.sliderContainer}
          onLayout={handleLayout}
          {...panResponder.panHandlers}
        >
          <View style={volumeStyles.track}>
            <View 
              style={[
                volumeStyles.fill, 
                { width: `${displayVolume * 100}%` }
              ]} 
            />
          </View>
          <View 
            style={[
              volumeStyles.thumb,
              { left: `${displayVolume * 100}%` }
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const volumeStyles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15 * S, 
    gap: 19 * S 
  },
  muteBtn: { 
    width: 100 * S, 
    height: 56 * S, 
    borderRadius: 10 * S, 
    backgroundColor: '#282828', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  box: { 
    flex: 1, 
    height: 56 * S, 
    borderRadius: 10 * S, 
    backgroundColor: '#282828', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 10 * S, 
    paddingRight: 10 * S 
  },
  sliderContainer: { 
    flex: 1, 
    height: 56 * S, 
    marginLeft: 8 * S, 
    justifyContent: 'center', 
    position: 'relative' 
  },
  track: { 
    height: 4 * S, 
    borderRadius: 2 * S, 
    backgroundColor: '#373737',
    width: '100%' 
  },
  fill: { 
    height: '100%', 
    borderRadius: 2 * S, 
    backgroundColor: '#FF4199',
    position: 'absolute',
    left: 0,
    top: 0
  },
  thumb: { 
    width: 20 * S, 
    height: 20 * S, 
    borderRadius: 10 * S, 
    backgroundColor: '#FF4199', 
    position: 'absolute', 
    top: '50%', 
    marginTop: -10 * S,
    marginLeft: -10 * S,
  },
});

// ─── Equalizer bars (animated) ──────────────────────────
const EqualizerBars = () => {
  const anim1 = useRef(new Animated.Value(20)).current;
  const anim2 = useRef(new Animated.Value(14)).current;
  const anim3 = useRef(new Animated.Value(17)).current;

  useEffect(() => {
    const loop = (anim: Animated.Value, min: number, max: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: false }),
          Animated.timing(anim, { toValue: min, duration: dur, useNativeDriver: false }),
        ])
      );
    const animations = [loop(anim1, 8, 22, 400), loop(anim2, 6, 18, 350), loop(anim3, 10, 20, 450)];
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, []);

  return (
    <View style={eqStyles.container}>
      <Animated.View style={[eqStyles.bar, { height: anim1 }]} />
      <Animated.View style={[eqStyles.bar, { height: anim2 }]} />
      <Animated.View style={[eqStyles.bar, { height: anim3 }]} />
    </View>
  );
};

const eqStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 22,
    gap: 2 * S,
    marginTop: 16 * S,
  },
  bar: {
    width: 5 * S,
    backgroundColor: '#FF4199',
    borderRadius: 10,
  },
});

// ─── Main CarModeScreen ─────────────────────────────────
export const CarModeScreen: React.FC<CarModeScreenProps> = ({ visible, onClose, stations: propStations }) => {
  const { t } = useTranslation();
  const { currentStation, playbackState, nowPlaying } = usePlayerStore();
  const { playStation, togglePlayPause, setVolume } = useAudioPlayer();
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const insets = useSafeAreaInsets();

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading' || playbackState === 'buffering';

  // CRITICAL: Freeze station list when Car Mode opens.
  // This prevents the list from re-ordering when a new station is played (which
  // triggers a similar-stations refetch in player.tsx, changing the prop).
  const [stations, setStations] = useState<Station[]>([]);
  const stationsInitRef = useRef(false);

  useEffect(() => {
    if (visible && !stationsInitRef.current) {
      stationsInitRef.current = true;
      
      // Build station list with currentStation always first
      let list: Station[] = [];
      
      // Add current station first if exists
      if (currentStation) {
        list.push(currentStation);
      }
      
      // Add other stations (excluding currentStation to avoid duplicates)
      propStations.forEach(s => {
        if (!currentStation || s._id !== currentStation._id) {
          list.push(s);
        }
      });
      
      setStations(list);
      // Set carousel to index 0 (currentStation)
      setCarouselIndex(0);
    }
    if (!visible) {
      stationsInitRef.current = false;
      setStations([]);
    }
  }, [visible, propStations, currentStation]);

  const [carouselIndex, setCarouselIndex] = useState(0);

  // Reset carousel index when CarMode is closed
  useEffect(() => {
    if (!visible) {
      setCarouselIndex(0);
    }
  }, [visible]);

  const getLogoUrl = useCallback((station: Station) => {
    return getStationLogoUrl(station, 'large');
  }, []);

  const handleIndexChange = useCallback((newIndex: number) => {
    setCarouselIndex(newIndex);
    const station = stations[newIndex];
    if (station && station._id !== currentStation?._id) {
      playStation(station);
    }
  }, [stations, currentStation?._id, playStation]);

  const handlePrev = useCallback(() => {
    if (stations.length === 0) return;
    handleIndexChange((carouselIndex - 1 + stations.length) % stations.length);
  }, [carouselIndex, stations.length, handleIndexChange]);

  const handleNext = useCallback(() => {
    if (stations.length === 0) return;
    handleIndexChange((carouselIndex + 1) % stations.length);
  }, [carouselIndex, stations.length, handleIndexChange]);

  const handleVolumeChange = async (value: number) => {
    setVolumeState(value);
    if (!isMuted) await setVolume(value);
  };

  const handleMuteToggle = async () => {
    if (isMuted) {
      setIsMuted(false);
      await setVolume(volume);
    } else {
      setIsMuted(true);
      await setVolume(0);
    }
  };

  const getCurrentSongInfo = () => {
    if (nowPlaying?.title) return nowPlaying.title;
    if (currentStation?.genres?.[0]) return currentStation.genres[0];
    return 'Live Radio';
  };

  if (!visible) return null;

  // Use carousel index to determine displayed station (matches the visual carousel card)
  const displayedStation = stations.length > 0 ? stations[carouselIndex] : currentStation;

  const ub = { fontFamily: 'Ubuntu-Bold' as const };

  // Get iOS status bar height for proper safe area
  const statusBarHeight = Platform.OS === 'ios' ? 54 : StatusBar.currentHeight || 0;
  // Calculate bottom padding including system navigation bar
  const bottomPadding = Platform.OS === 'ios' ? 34 : Math.max(20, insets.bottom + 10);

  return (
    <View style={styles.overlay} testID="car-mode-screen">
      <StatusBar barStyle="light-content" backgroundColor="#1B1C1E" />
      
      {/* Main content with manual safe area padding */}
      <View style={[styles.contentContainer, { paddingTop: statusBarHeight, paddingBottom: bottomPadding }]}>
        {/* ── Header ─────────────────── */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, ub]}>{t('car_mode', 'Car Mode')}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            testID="car-mode-close-btn"
          >
            <Text style={[styles.closeBtnText, ub]}>{t('close', 'Close')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Station Carousel ────────── */}
        <View style={styles.carouselSection}>
          {/* Purple glow behind center card */}
          <View style={styles.centerGlow}>
            <GlowEffect size={260 * S} top={0} left={0} opacity={0.50} />
          </View>
          <StationCarousel
            stations={stations}
            currentIndex={carouselIndex}
            onIndexChange={handleIndexChange}
            getLogoUrl={getLogoUrl}
          />
        </View>

        {/* ── Equalizer ──────────────── */}
        <EqualizerBars />

        {/* ── Station Name + Song ─────── */}
        <View style={styles.infoSection}>
          <Text
            style={[styles.stationName, ub]}
            numberOfLines={1}
            testID="car-mode-station-name"
          >
            {displayedStation?.name || 'No Station'}
          </Text>
          <Text style={styles.songInfo} numberOfLines={1}>
            {getCurrentSongInfo()}
          </Text>
        </View>

        {/* ── Controls: Prev | Pause | Next ─── */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={handlePrev} testID="car-mode-prev-btn">
            <View style={styles.iconRow}>
              <View style={styles.prevBarLine} />
              <View style={styles.prevTriangle} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={togglePlayPause} testID="car-mode-playpause-btn">
            {isLoading ? <ActivityIndicator testID="car-mode-loading" color="#FFFFFF" /> : isPlaying ? (
              <View style={styles.iconRow}>
                <View style={styles.pauseBar} />
                <View style={[styles.pauseBar, { marginLeft: 12 * S }]} />
              </View>
            ) : (
              <View style={styles.playTriangle} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={handleNext} testID="car-mode-next-btn">
            <View style={styles.iconRow}>
              <View style={styles.nextTriangle} />
              <View style={styles.nextBarLine} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Volume: Mute | Slider ────── */}
        <VolumeSlider
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
        />
      </View>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────
const BTN = 100 * S;
const GAP = 19 * S;
const BR = 10 * S;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1B1C1E',
    zIndex: 1000,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // Home indicator safe area
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15 * S,
    paddingTop: 10 * S,
  },
  headerTitle: { fontSize: 18 * S, color: '#FFF' },
  closeBtn: {
    backgroundColor: '#2F2F2F',
    paddingHorizontal: 21 * S,
    paddingVertical: 14 * S,
    borderRadius: 25 * S,
  },
  closeBtnText: { fontSize: 15 * S, color: '#FFF', textAlign: 'center' },

  carouselSection: { 
    alignItems: 'center',
    position: 'relative',
  },
  
  // Purple glow effect behind center card
  centerGlow: {
    position: 'absolute',
    top: -40 * S,
    left: SCREEN_WIDTH / 2 - 130 * S,
    width: 260 * S,
    height: 260 * S,
    borderRadius: 130 * S,
    overflow: 'hidden',
  },

  infoSection: { alignItems: 'center', paddingHorizontal: 20 * S },
  stationName: { fontSize: 20 * S, color: '#FFF', textAlign: 'center' },
  songInfo: { fontSize: 15 * S, fontWeight: '400', color: '#FFF', textAlign: 'center', marginTop: 3 * S },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: 15 * S,
  },
  controlBtn: {
    width: BTN, height: BTN, borderRadius: BR,
    backgroundColor: '#282828',
    justifyContent: 'center', alignItems: 'center',
  },
  iconRow: { flexDirection: 'row', alignItems: 'center' },

  prevBarLine: { width: 6 * S, height: 36 * S, backgroundColor: '#FFF', borderRadius: 2, marginRight: 4 * S },
  prevTriangle: {
    width: 0, height: 0,
    borderTopWidth: 20 * S, borderBottomWidth: 20 * S, borderRightWidth: 32 * S,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#FFF',
  },
  pauseBar: { width: 14 * S, height: 42 * S, backgroundColor: '#FFF', borderRadius: 3 },
  playTriangle: {
    width: 0, height: 0,
    borderTopWidth: 22 * S, borderBottomWidth: 22 * S, borderLeftWidth: 36 * S,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFF',
    marginLeft: 4 * S,
  },
  nextTriangle: {
    width: 0, height: 0,
    borderTopWidth: 20 * S, borderBottomWidth: 20 * S, borderLeftWidth: 32 * S,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#FFF',
  },
  nextBarLine: { width: 6 * S, height: 36 * S, backgroundColor: '#FFF', borderRadius: 2, marginLeft: 4 * S },

  volumeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 * S, gap: GAP },
  muteBtn: { width: BTN, height: 56 * S, borderRadius: BR, backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center' },
  volumeBox: { flex: 1, height: 56 * S, borderRadius: BR, backgroundColor: '#282828', flexDirection: 'row', alignItems: 'center', paddingLeft: 10 * S, paddingRight: 6 * S },
});

export default CarModeScreen;

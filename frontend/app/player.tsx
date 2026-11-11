import {StationCountryBadge} from '../src/components/StationCountryBadge';
import {previewSafeArea} from '../src/utils/previewSafeArea';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  PanResponder,
  useWindowDimensions,
  Linking,
  BackHandler,
  AccessibilityInfo} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { usePlayerStore } from '../src/store/playerStore';
import { useRecentlyPlayedStore } from '../src/store/recentlyPlayedStore';
import { useSimilarStations, usePopularStations, useStation, queryKeys } from '../src/hooks/useQueries';
import { useAuthStore } from '../src/store/authStore';
import { useFavoritesStore } from '../src/store/favoritesStore';
import { usePremiumStore } from '../src/store/premiumStore';
import { CarModeScreen } from '../src/components/CarModeScreen';
import { ShareModal } from '../src/components/ShareModal';
import { SleepTimerModal } from '../src/components/SleepTimerModal';
import { useQueryClient } from '@tanstack/react-query';
import { metadataNotice } from '../src/utils/metadataNotice';
import { currentTrackText, trackSearchUrls } from '../src/utils/nowPlaying';
import { DeezerIcon } from '../src/components/DeezerIcon';
import { ProfilePhotoFeedback } from '../src/components/ProfilePhotoFeedback';
import { formatVoteCount } from '../src/utils/voteCount';
import { StationVoteButton } from '../src/components/StationVoteButton';
import { PlayerOptionsSheet } from '../src/components/PlayerOptionsSheet';
import { PremiumPaywall } from '../src/components/PremiumPaywall';
import { NativeCastButton } from '../src/components/NativeCastButton';
import { useNativeCast } from '../src/contexts/NativeCastContext';
import { isAirplayAvailable, showAirplayPicker } from '../src/services/nativeCasting';
import { getStationLogoUrl } from '../src/utils/stationLogoHelper';
import { usePlayerArtwork } from '../src/hooks/usePlayerArtwork';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import type { Station } from '../src/types';
import { PlayerEqualizer } from '../src/components/PlayerEqualizer';
import { PlayerErrorState } from '../src/components/PlayerErrorState';
import {reportStationIssue} from '../src/services/stationIssueReporter';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_LOGO = require('../assets/megaradio-icon.png');
const DISMISS_THRESHOLD = 150; // Minimum swipe distance to dismiss
// Base sizes - will be scaled for tablets
const GRID_PADDING = 16;
const GRID_GAP = 24;

// GridItem extracted OUTSIDE PlayerScreen to prevent unmount/remount on re-render
const GridItem = React.memo(function GridItem({
  station,
  onPress,
  getLogoUrl,
  itemWidth,
  disabled = false,
}: {
  station: Station;
  onPress: (station: Station) => void;
  getLogoUrl: (station: Station) => string | null;
  itemWidth: number;
  disabled?: boolean;
}) {
  const stationLogo = getLogoUrl(station);

  return (
    <TouchableOpacity
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={[styles.gridItem, { width: itemWidth }]}
      onPress={() => onPress(station)}
      activeOpacity={0.7}
      delayPressIn={0}
      testID={`grid-item-${station._id}`}
    >
      <View style={[styles.gridImageWrapper, { width: itemWidth, height: itemWidth }]}>
        <ImageWithFallback
          testID={`player-grid-logo-${station._id}`}
          uri={stationLogo}
          style={styles.gridImage}
          contentFit="contain"
        />
      </View>
      <Text style={styles.gridStationName} numberOfLines={1}>
        {station.name}
      </Text>
      <Text style={styles.gridStationLocation} numberOfLines={1}>
        {station.country || 'Radio'}{(station.city || station.state) ? <Text style={styles.gridCity}>, {station.city || station.state}</Text> : null}
      </Text>
    </TouchableOpacity>
  );
});

export default function PlayerScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const metadataStatus = usePlayerStore(state=>state.metadataStatus);
  const queryClient = useQueryClient();
  const { isAuthenticated, token } = useAuthStore();
  const { isPremium, hasFeature } = usePremiumStore();
  const [playerNotice, setPlayerNotice] = useState<{error:boolean;message:string}|null>(null);
  const dismissPlayerNotice = useCallback(() => setPlayerNotice(null), []);
  const [showCarMode, setShowCarMode] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const lockState = useRef(false);
  lockState.current = controlsLocked;
  const { notify: showCastNotice } = useNativeCast();
  const [lockNotice, setLockNotice] = useState<'locked' | 'unlocked' | null>(null);
  const lockNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (lockNoticeTimer.current) clearTimeout(lockNoticeTimer.current); }, []);
  const toggleControlsLock = useCallback(() => {
    const next = !lockState.current;
    lockState.current = next;
    setControlsLocked(next);
    setLockNotice(next ? 'locked' : 'unlocked');
    if (lockNoticeTimer.current) clearTimeout(lockNoticeTimer.current);
    lockNoticeTimer.current = setTimeout(() => { setLockNotice(null); lockNoticeTimer.current = null; }, next ? 2200 : 1400);
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(t(next ? 'player_locked_notice' : 'player_unlocked_notice', next ? 'Locked' : 'Unlocked'));
  }, [t]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => lockState.current);
    return () => subscription.remove();
  }, []));
  // Offline replaces the control row; release the lock so its unlock action cannot disappear.
  useEffect(() => { if (isOffline) { lockState.current = false; setControlsLocked(false); setLockNotice(null); } }, [isOffline]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMode, setPaywallMode] = useState<'premium' | 'remove_ads'>('premium');
  // Main artwork image load error → fall back to local MegaRadio logo.
  const [artworkError, setArtworkError] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerScrollY = useRef(new Animated.Value(0)).current;
  const playerScrollOffset = useRef(0);
  const insets = useSafeAreaInsets();

  // Responsive layout
  const { width: windowWidth } = useWindowDimensions();
  // Figma App / station-playing 2294:8820: radio-logo is 183px on 375px.
  // Keep its screen ratio on larger phones; the shared 190px cap shrank it.
  const LOGO_SIZE = 183 * Math.max(1, Math.min(windowWidth / 375, 1.5));
  const GRID_ITEM_WIDTH = (windowWidth - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

  // Swipe to dismiss animation
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Dismiss function with animation
  const dismissWithAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Check if we can go back, otherwise navigate to tabs
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    });
  }, [translateY, opacity, router]);

  // Pan responder for swipe down gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          // Fade out as user swipes down
          const newOpacity = Math.max(0, 1 - gestureState.dy / SCREEN_HEIGHT);
          opacity.setValue(newOpacity);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
          // Dismiss if swiped far enough or fast enough
          dismissWithAnimation();
        } else {
          // Snap back to original position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const {
    currentStation: activeStation,
    playbackState,
    nowPlaying,
    streamUrl,
    sleepTimerActive,
    sleepTimerRemaining,
    startSleepTimer,
    cancelSleepTimer,
  } = usePlayerStore();

  const { stations: recentStations, loadFromStorage: loadRecent } = useRecentlyPlayedStore();

  // Load recent stations on mount
  useEffect(() => { loadRecent(); }, []);

  const { playStation, togglePlayPause, stopPlayback } = useAudioPlayer();

  // Explicit browser-only visual preview uses real catalog data without changing playback.
  const { preview, car, premium, locked, more, share, failure, sleep, empty } = useLocalSearchParams<{ empty?: string; sleep?: string; failure?: string; preview?: string; car?: string; premium?: string; locked?: string; more?: string; share?: string }>();
  const { data: popularData } = usePopularStations(undefined, 12);
  const previewTopInset = previewSafeArea().top;
  const previewEnabled = Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && preview === '1';
  useEffect(() => { if (__DEV__ && previewEnabled && sleep === '1') setShowSleepTimer(true); }, [previewEnabled, sleep]);
  useEffect(() => { if (previewEnabled && car === '1') setShowCarMode(true); }, [previewEnabled, car]);
  useEffect(() => { if (previewEnabled && premium === '1') setShowPaywall(true); }, [previewEnabled, premium]);
  useEffect(() => { if (previewEnabled && locked === '1') setControlsLocked(true); }, [previewEnabled, locked]);
  useEffect(() => { if (previewEnabled && more === '1') setShowOptionsSheet(true); }, [previewEnabled, more]);
  useEffect(() => {
    if (previewEnabled) window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'locked', visible: controlsLocked }, 'http://localhost:8082');
  }, [previewEnabled, controlsLocked]);
  useEffect(() => { if (previewEnabled && share === '1') setShowShareModal(true); }, [previewEnabled, share]);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const emptyPreview = __DEV__ && previewEnabled && empty === '1';
  const currentStation = emptyPreview ? null : activeStation || (previewEnabled ? popularData?.stations?.find(station => station.countryCode || station.countrycode) || popularData?.stations?.[0] : null);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'player', visible: visible && !!currentStation, scrollY: playerScrollOffset.current }, 'http://localhost:8082');
      notify(true);
      return () => notify(false);
    }
  }, [!!currentStation]));
  useEffect(() => { if (!currentStation && !previewEnabled) { lockState.current = false; setControlsLocked(false); setLockNotice(null); } }, [currentStation?._id, previewEnabled]);
  const { data: stationDetails } = useStation(currentStation?._id || '');
  const rawVotes = stationDetails?.votes ?? currentStation?.votes;
  const voteCount = typeof rawVotes === 'number' && Number.isFinite(rawVotes) && rawVotes >= 0 ? Math.floor(rawVotes) : null;
  const formattedVotes = voteCount === null ? '' : formatVoteCount(voteCount, i18n.language);
  const { data: similarData } = useSimilarStations(currentStation?._id || '', 9);



  // Use favoritesStore for guest/authenticated favorites
  const { isFavorite: checkIsFavorite, toggleFavorite } = useFavoritesStore();
  const [checkingFavorite, setCheckingFavorite] = useState(false);

  // Visual preview must not mutate account or guest favorites while verifying icons.
  const [previewFavorite, setPreviewFavorite] = useState(false);
  useEffect(() => setPreviewFavorite(false), [currentStation?._id]);
  const isFavorite = previewEnabled ? previewFavorite : currentStation ? checkIsFavorite(currentStation._id) : false;

  const handleClose = () => {
    // Check if we can go back, otherwise navigate to tabs
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentStation) return;
    if (previewEnabled) { setPreviewFavorite(value => !value); return; }

    setCheckingFavorite(true);
    try {
      await toggleFavorite(currentStation);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    } finally {
      setCheckingFavorite(false);
    }
  };

  // Handle station press - ALWAYS stops current and plays new
  const handleStationPress = useCallback(async (station: Station) => {
    console.log('[Player] Station pressed:', station.name, 'ID:', station._id);
    // Send to remote log for debugging
    try {
      // Always call playStation - it handles stopping internally
      await playStation(station);
      console.log('[Player] playStation completed for:', station.name);
    } catch (error) {
      console.error('[Player] Failed to play station:', error);
    }
  }, [playStation, currentStation]);

  // Sleep timer handler using global store
  const handleSleepTimerStart = useCallback((totalMinutes: number) => {
    startSleepTimer(totalMinutes, () => stopPlayback());
  }, [startSleepTimer, stopPlayback]);

  // A network-induced error remains a connection retry, never a station report.
  const offlineFailure=useRef<{id?:string;offline:boolean}>({offline:false});
  if(offlineFailure.current.id!==currentStation?._id||['idle','loading','playing','paused'].includes(playbackState))offlineFailure.current={id:currentStation?._id,offline:false};
  if(isOffline&&playbackState==='error')offlineFailure.current.offline=true;
  const showOffline = isOffline || (playbackState==='error'&&offlineFailure.current.offline) || (previewEnabled && failure === 'offline');
  useEffect(()=>{
    if(Platform.OS==='web'&&previewEnabled){window.parent.postMessage({type:'megaradio-preview-theme',screen:'playerOffline',visible:showOffline},'http://localhost:8082');return()=>window.parent.postMessage({type:'megaradio-preview-theme',screen:'playerOffline',visible:false},'http://localhost:8082');}
  },[showOffline,previewEnabled]);
  const showRadioError = playbackState === 'error' || (previewEnabled && failure === 'radio');
  const [radioReport,setRadioReport]=useState<{id:string;status:'sending'|'sent'}|null>(null);
  const reportBusy=useRef(new Set<string>()),reportMounted=useRef(true),reportTarget=useRef(currentStation?._id);
  reportTarget.current=currentStation?._id;
  useEffect(()=>{reportMounted.current=true;return()=>{reportMounted.current=false;};},[]);
  const reportStatus=radioReport&&radioReport.id===currentStation?._id?radioReport.status:'idle';
  const handleRadioReport=async()=>{
    if(!currentStation||!showRadioError||showOffline||reportBusy.current.has(currentStation._id)||reportStatus!=='idle')return;
    const station={...currentStation},id=station._id;
    reportBusy.current.add(id);setRadioReport({id,status:'sending'});
    try{
      // Forced visual error previews never submit a report against a real station.
      const simulated=__DEV__&&previewEnabled&&failure==='radio';
      const result=simulated?'preview':await reportStationIssue({station,message:usePlayerStore.getState().errorMessage,platform:Platform.OS,language:i18n.language});
      if(reportMounted.current&&reportTarget.current===id){
        setRadioReport({id,status:'sent'});
        setPlayerNotice({error:false,message:t(result==='already'?'player_report_already':'player_report_thanks')});
      }
    }catch{
      if(reportMounted.current&&reportTarget.current===id){setRadioReport(null);setPlayerNotice({error:true,message:t('player_report_failed')});}
    }finally{reportBusy.current.delete(id);}
  };

  const isLoading = playbackState === 'loading' || playbackState === 'buffering';
  const isPlaying = playbackState === 'playing' || (previewEnabled && !activeStation && previewPlaying);

  const getLogoUrl = useCallback((station: Station) => {
    // Use centralized helper with 'large' preference for player screen
    return getStationLogoUrl(station, 'large');
  }, []);

  // Slim catalog cards may omit the archived original; reuse the details query.
  const artworkStation = currentStation && stationDetails?._id === currentStation._id
    ? { ...currentStation, logoAssets: stationDetails.logoAssets || currentStation.logoAssets }
    : currentStation;
  const fallbackLogoUrl = artworkStation ? getLogoUrl(artworkStation) : null;
  const logoUrl = usePlayerArtwork(artworkStation, fallbackLogoUrl);

  // Reset artwork error when the station changes so the new logo gets a fresh try.
  React.useEffect(() => {
    setArtworkError(false);
  }, [currentStation?._id, logoUrl]);

  // Memoize stations to prevent re-renders
  const popularStations = useMemo(() => {
    return popularData?.stations || (Array.isArray(popularData) ? popularData : []);
  }, [popularData]);

  const similarStations = useMemo(() => {
    const similar = similarData?.stations || (Array.isArray(similarData) ? similarData : []);
    return similar.filter((s: Station) => s._id !== currentStation?._id);
  }, [similarData, currentStation?._id]);

  const displaySimilarStations = useMemo(() => {
    if (similarStations.length > 0) return similarStations;
    return popularStations.filter((s: Station) => s._id !== currentStation?._id);
  }, [similarStations, popularStations, currentStation?._id]);

  // Play next station from similar stations (uses filtered list that excludes current station)
  const handleNextStation = useCallback(() => {
    // Use displaySimilarStations which already excludes current station
    if (displaySimilarStations.length > 0) {
      // Pick a random station from the filtered list
      const randomIndex = Math.floor(Math.random() * displaySimilarStations.length);
      const nextStation = displaySimilarStations[randomIndex];
      console.log('[Player] Playing next station:', nextStation?.name);
      if (nextStation) {
        playStation(nextStation);
      }
    }
  }, [displaySimilarStations, playStation]);

  // Play previous station from recently played
  const handlePreviousStation = useCallback(() => {
    // Find the station before the current one in recent history
    const currentIndex = recentStations.findIndex(s => s._id === currentStation?._id);
    if (currentIndex > 0) {
      // Play the previous station in history
      const prevStation = recentStations[currentIndex - 1];
      console.log('[Player] Playing previous station:', prevStation?.name);
      playStation(prevStation);
    } else {
      // No previous station, play random from filtered similar stations
      if (displaySimilarStations.length > 0) {
        const randomIndex = Math.floor(Math.random() * displaySimilarStations.length);
        const randomStation = displaySimilarStations[randomIndex];
        console.log('[Player] No previous, playing random similar:', randomStation?.name);
        if (randomStation) {
          playStation(randomStation);
        }
      }
    }
  }, [recentStations, currentStation, displaySimilarStations, playStation]);

  const trackText = currentTrackText(nowPlaying, currentStation?.name || '', currentStation?.country);
  const getCurrentSongInfo = () => trackText || t('live_radio', 'Live Radio');

  if (!currentStation) {
    return (
      <SafeAreaView style={styles.emptyPage} testID="player-empty-state">
        <View style={styles.emptyHeader}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('back', 'Back')} onPress={handleClose} style={styles.emptyBack}>
            <Image source={require('../assets/images/all-stations/back.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyCard}>
            <Image source={require('../assets/images/player/broadcast.svg')} style={{ width: 48, height: 48 }} contentFit="contain" accessible={false} />
            <Text style={styles.emptyTitle}>{t('no_station_playing', 'No station playing')}</Text>
            <Text style={styles.emptyText}>{t('select_station_to_listen', 'Select a station to start listening')}</Text>
            <TouchableOpacity testID="player-empty-home" accessibilityRole="button" style={styles.goBackButton} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.goBackButtonText}>{t('nav_discover', 'Discover')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const unavailable=metadataNotice(previewEnabled&&!activeStation?'unavailable':metadataStatus,i18n.language);
  const unavailableMessage=t(unavailable.key,unavailable.message);
  const openTrackPlatform = async (platform: keyof ReturnType<typeof trackSearchUrls>) => {
    const state=usePlayerStore.getState();
    const station=state.currentStation||currentStation;
    const track=currentTrackText(state.nowPlaying,station?.name||'',station?.country);
    if(!track){
      const notice=metadataNotice(previewEnabled&&!activeStation?'unavailable':state.metadataStatus,i18n.language);
      setPlayerNotice({error:state.metadataStatus==='error',message:t(notice.key,notice.message)});return;
    }
    const target=trackSearchUrls(track)[platform];
    try {
      if(Platform.OS==='web')await Linking.openURL(target.web);
      else {try{await Linking.openURL(target.app);}catch{await Linking.openURL(target.web);}}
    } catch {
      const notice=metadataNotice('error',i18n.language);
      setPlayerNotice({error:true,message:t(notice.key,notice.message)});
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        showOffline && {backgroundColor:'#1B1C1E'},
        {
          transform: [{ translateY }],
          opacity,
        }
      ]}
    >
      {/* Figma SCROLLS: the glow stays attached to the artwork, beneath the fixed header. */}
      <Animated.View testID="player-scroll-glow" pointerEvents="none" style={[styles.playerGlowLayer, { transform: [{ translateY: Animated.multiply(playerScrollY, -1) }] }]}>
        <Image testID="player-background-glow" source={require('../assets/images/player/background-glow.svg')} style={[styles.playerBackground, { top: -172 - previewTopInset }]} contentFit="fill" />
      </Animated.View>
      <View pointerEvents="none" style={[styles.playerHeaderShade, { height: insets.top + 60 }]} />
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
          {/* Header */}
          <View testID="player-fixed-header" style={styles.headerContainer} {...(controlsLocked ? {} : panResponder.panHandlers)}>
            <View style={styles.header}>
              <TouchableOpacity disabled={controlsLocked} style={styles.headerButton} onPress={dismissWithAnimation}>
                <Image source={require('../assets/images/player/collapse.svg')} style={styles.figmaIcon} contentFit="contain" />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                {!showOffline&&<TouchableOpacity disabled={controlsLocked} accessibilityRole="button" accessibilityLabel={t('hd_quality', 'HD quality')} onPress={() => { if (!hasFeature('hd_stream')) { setPaywallMode('premium'); setShowPaywall(true); } else { setShowOptionsSheet(true); } }} style={styles.hdShortcut}>
                  <Image source={require('../assets/images/player/hd.svg')} style={{ width: 26, height: 16 }} contentFit="contain" />
                </TouchableOpacity>}
                <Text style={styles.headerTitle} numberOfLines={1}>{currentStation.name}</Text>
              </View>
              <View style={styles.headerRight}>
                {!showOffline&&<TouchableOpacity disabled={controlsLocked}
                  style={styles.headerIcon}
                  onPress={() => {
                    console.log('[Player] Car Mode button pressed');
                    setShowCarMode(true);
                  }}
                  accessibilityLabel={t('car_mode', 'Car Mode')}
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Image source={require('../assets/images/player/car.svg')} style={{ width: 26, height: 26 }} contentFit="contain" />
                </TouchableOpacity>}
                <TouchableOpacity disabled={controlsLocked}
                  style={styles.headerIcon}
                  onPress={() => setShowOptionsSheet(true)}
                  testID="player-more-button"
                  accessibilityRole="button"
                  accessibilityLabel={t('more', 'More')}
                >
                  <Image source={require('../assets/images/player/more.svg')} style={{ width: 24, height: 6 }} contentFit="contain" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

        {showOffline ? <View style={[styles.offlineContent,{paddingBottom:60+insets.top-insets.bottom+(previewTopInset?previewTopInset-previewSafeArea().bottom:0)}]}>
          <PlayerErrorState offline onRetry={() => { if (activeStation) void playStation(activeStation); }} />
        </View> : <Animated.ScrollView
          testID="player-scroll-content"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: playerScrollY } } }], {
            useNativeDriver: Platform.OS !== 'web',
            listener: (event: any) => {
              playerScrollOffset.current = event.nativeEvent.contentOffset.y;
              if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
                window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'player', visible: true, scrollY: playerScrollOffset.current }, 'http://localhost:8082');
              }
            },
          })}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 16 + insets.bottom }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Album Art */}
          <View style={styles.artworkContainer}>
            <View testID="player-artwork-slot" style={{ width: LOGO_SIZE, height: LOGO_SIZE, alignItems: 'center' }}>
            {showRadioError ? <PlayerErrorState artworkSize={LOGO_SIZE} onReport={handleRadioReport} reportStatus={reportStatus} stationName={currentStation?.name}/> : isLoading ? <View testID="player-connecting-artwork" accessibilityRole="progressbar" accessibilityLabel={t('connecting', 'Connecting…')} style={[styles.artworkWrapper, styles.artworkConnecting, { width: LOGO_SIZE, height: LOGO_SIZE }]}>
              <ActivityIndicator color="#FF4199" size="large" />
            </View> : <View style={{ width: LOGO_SIZE, height: LOGO_SIZE }}>
              <View style={[styles.artworkWrapper, { width: LOGO_SIZE, height: LOGO_SIZE }]}>
              <ImageWithFallback testID="player-station-logo" uri={logoUrl} fallbackUri={fallbackLogoUrl || undefined} style={styles.artwork} contentFit="contain" />
              </View>
              <StationCountryBadge station={currentStation} disabled={controlsLocked} testID="player-country" style={{right:-20,bottom:-20}}/>
            </View>}
            </View>
          </View>

          {/* Now Playing Info */}
          <View style={styles.nowPlayingSection}>
            {/* Animated Equalizer Bars */}
            <View style={styles.equalizerSlot}><PlayerEqualizer playing={isPlaying} /></View>
            <Text style={styles.stationName}>{currentStation.name}</Text>

            {/* Song Info - Visible to ALL users */}
            <Text style={styles.artistName} testID="now-playing-song-info">{getCurrentSongInfo()}</Text>


            {/* External song searches, available to all users when track metadata is valid. */}
            <View style={styles.socialIcons}>
              {([
                { platform: 'spotify', image: require('../assets/images/player/spotify.svg'), label: t('search_on_spotify', 'Search on Spotify') },
                { platform: 'appleMusic', image: null, label: t('search_on_apple_music', 'Search on Apple Music') },
                { platform: 'youtube', image: require('../assets/images/player/youtube.svg'), label: t('search_on_youtube', 'Search on YouTube') },
                { platform: 'deezer', image: null, label: t('search_on_deezer', 'Search on Deezer') },
              ] as const).map(({ platform, image, label }) => (
                <TouchableOpacity
                  key={platform}
                  style={[styles.socialButton, !trackText && { opacity: 0.4 }]}
                  onPress={() => openTrackPlatform(platform)}
                  disabled={controlsLocked}
                  hitSlop={7}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: controlsLocked }}
                  accessibilityHint={!trackText ? unavailableMessage : undefined}
                  accessibilityLabel={label}
                  testID={`${platform}-deep-link-btn`}
                >
                  <View style={styles.socialIconSlot}>
                    {platform === 'deezer' ? <DeezerIcon /> : platform === 'appleMusic' ? <Ionicons name="logo-apple" size={26} color="#FFFFFF" accessible={false} /> :
                      <Image source={image} style={styles.socialLogo} contentFit="contain" accessible={false} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.communitySummary}>
              {voteCount !== null && <>
                <View style={styles.voteSummary} testID="player-vote-count">
                  <LinearGradient colors={['transparent','#4A5053']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.voteHairline} />
                  <StationVoteButton disabled={controlsLocked} preview={previewEnabled} countLabel={formattedVotes} fullCount={voteCount} onNotice={setPlayerNotice} key={currentStation._id} stationId={currentStation._id} onVoted={votes => {
                    queryClient.setQueryData(queryKeys.station(currentStation._id), { ...(stationDetails || currentStation), votes });
                    void queryClient.invalidateQueries({queryKey: queryKeys.stations});
                  }} />
                  <LinearGradient colors={['#4A5053','transparent']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.voteHairline} />
                </View>
              </>}
            </View>
          </View>


          {/* Main Controls */}
          <View style={styles.mainControls}>
            {/* Timer - different behavior based on timer state */}
            <TouchableOpacity disabled={controlsLocked}
              style={styles.controlButton}
              onPress={() => {
                setShowSleepTimer(true);
              }}
              testID="player-sleep-timer-btn"
              accessibilityRole="button" accessibilityLabel={t('sleep_timer', 'Sleep Timer')}
            >
              <View>
                <Image source={require('../assets/images/player/timer.svg')} style={styles.figmaIcon} contentFit="contain" />
                {sleepTimerActive && (
                  <View style={styles.timerOnBadge}>
                    <Text style={styles.timerOnText}>ON</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Previous */}
            <TouchableOpacity disabled={controlsLocked}
              style={styles.skipButton}
              testID="player-previous-btn" accessibilityRole="button" accessibilityLabel={t('previous', 'Previous')}
              onPress={handlePreviousStation}
            >
              <Image source={require('../assets/images/player/previous.svg')} style={styles.skipIcon} contentFit="contain" />
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={() => {
                console.log('[Player] Play/Pause pressed, playbackState:', playbackState);
                if (previewEnabled && !activeStation) setPreviewPlaying(value => !value);
                else if (showRadioError && activeStation) void playStation(activeStation);
                else togglePlayPause();
              }}
              disabled={controlsLocked || (isLoading)}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? t('pause', 'Pause') : t('play', 'Play')}
              testID="player-toggle-play"
            >
              {isLoading ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : isPlaying ? (
                <Image source={require('../assets/images/player/pause.svg')} style={styles.mainPlaybackIcon} contentFit="contain" />
              ) : (
                <Image source={require('../assets/images/player/play.svg')} style={styles.mainPlaybackIcon} contentFit="contain" />
              )}
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity disabled={controlsLocked}
              style={styles.skipButton}
              testID="player-next-btn" accessibilityRole="button" accessibilityLabel={t('next', 'Next')}
              onPress={handleNextStation}
            >
              <Image source={require('../assets/images/player/next.svg')} style={styles.skipIcon} contentFit="contain" />
            </TouchableOpacity>

            {/* Heart */}
            <TouchableOpacity
              style={styles.controlButton}
              testID="player-favorite-btn" accessibilityRole="button" accessibilityLabel={isFavorite ? t('remove_from_favorites', 'Remove from favorites') : t('add_to_favorites', 'Add to favorites')} accessibilityState={{ selected: isFavorite }}
              onPress={handleToggleFavorite}
              disabled={controlsLocked || (checkingFavorite)}
            >
              <Image
                source={isFavorite ? require('../assets/images/player/heart-filled.svg') : require('../assets/images/player/heart.svg')}
                style={styles.figmaIcon}
                tintColor={isFavorite ? '#FF4199' : undefined}
                contentFit="contain"
              />
            </TouchableOpacity>
          </View>

          {/* Secondary Controls */}
          <View style={styles.secondaryControls}>
            <View style={styles.leftSecondaryControls}>
              <TouchableOpacity style={styles.secondaryButton} onPress={toggleControlsLock} testID="player-lock-toggle" accessibilityRole="button" accessibilityLabel={controlsLocked ? t('unlock_screen', 'Unlock screen') : t('lock_screen', 'Lock screen')} accessibilityState={{ selected: controlsLocked }}>
                <Image source={controlsLocked ? require('../assets/images/player/locked-pink.svg') : require('../assets/images/player/unlock.svg')} style={styles.figmaIcon} contentFit="contain" accessible={false} />
              </TouchableOpacity>
              <NativeCastButton disabled={controlsLocked} />
            </View>
              {/* Share */}
              <TouchableOpacity disabled={controlsLocked}
                style={styles.secondaryButton}
                onPress={() => setShowShareModal(true)}
                testID="player-share-btn"
                accessibilityRole="button"
                accessibilityLabel={t('share', 'Share')}
              >
                <Image
                  source={require('../assets/images/player/share.svg')}
                  style={styles.figmaIcon}
                  contentFit="contain"
                />
              </TouchableOpacity>

          </View>

          {!isPremium && <TouchableOpacity disabled={controlsLocked} style={styles.premiumBanner} onPress={() => { setPaywallMode('premium'); setShowPaywall(true); }} activeOpacity={0.85} testID="player-premium-banner" accessibilityRole="button" accessibilityLabel="MegaRadio Premium">
            <LinearGradient colors={['#5C27F4', '#9F3FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.premiumGradient}>
              <Image source={require('../assets/images/home/premium.svg')} style={styles.premiumIcon} contentFit="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumTitle}>MegaRadio Premium</Text>
                <Text style={styles.premiumSubtitle}>{t('home_premium_subtitle', 'Unlock amazing features')}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>}

          {/* Recently Played Section */}
          {recentStations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('recently_played', 'Recently Played')}
            </Text>
            <View style={[styles.stationGrid, { columnGap: GRID_GAP }]}>
              {recentStations.slice(0, 6).map((station: Station, index: number) => (
                <GridItem
                  key={`recent-${station._id}-${index}`}
                  station={station}
                  onPress={handleStationPress}
                  disabled={controlsLocked}
                  getLogoUrl={getLogoUrl}
                  itemWidth={GRID_ITEM_WIDTH}
                />
              ))}
            </View>
          </View>
          )}

          {/* Similar Radios Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('similar_radios', 'Similar Radios')}
            </Text>
            <View style={[styles.stationGrid, { columnGap: GRID_GAP }]}>
              {displaySimilarStations.slice(0, 9).map((station: Station, index: number) => (
                <GridItem
                  key={`similar-${station._id}-${index}`}
                  station={station}
                  onPress={handleStationPress}
                  disabled={controlsLocked}
                  getLogoUrl={getLogoUrl}
                  itemWidth={GRID_ITEM_WIDTH}
                />
              ))}
            </View>
          </View>


        </Animated.ScrollView>}
      </View>

      {lockNotice === 'locked' && <Pressable testID="player-lock-overlay" accessibilityRole="button"
        accessibilityLabel={t('close', 'Close')} onPress={() => {
          if (lockNoticeTimer.current) clearTimeout(lockNoticeTimer.current);
          lockNoticeTimer.current = null;
          setLockNotice(null);
        }} style={styles.lockOverlay}>
        <View testID="player-lock-dialog" style={styles.lockDialog}>
          <Image source={require('../assets/images/player/locked-pink.svg')} style={styles.lockDialogIcon} contentFit="contain" accessible={false} />
          <Text style={styles.lockDialogTitle} accessibilityLiveRegion="polite">{t('screen_locked', 'Screen Locked!')}</Text>
          <Text style={styles.lockDialogHint}>{t('screen_unlock_hint', 'To unlock click on the icon')}</Text>
        </View>
      </Pressable>}
      {lockNotice === 'unlocked' && <View pointerEvents="none" style={[styles.lockNotice, { bottom: insets.bottom + 26 }]} testID="player-lock-notice">
        <Text style={styles.lockNoticeText} accessibilityLiveRegion="polite">{t('player_unlocked_notice', 'Unlocked')}</Text>
      </View>}
      {/* Car Mode Modal */}
      <CarModeScreen
        onOpenPremium={() => { setShowCarMode(false); setPaywallMode('premium'); setShowPaywall(true); }}
        previewStation={previewEnabled && !activeStation ? currentStation : undefined}
        visible={showCarMode}
        onClose={() => setShowCarMode(false)}
        stations={displaySimilarStations.length > 0 ? displaySimilarStations : popularStations}
      />

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        playing={isPlaying}
        onClose={() => setShowShareModal(false)}
        station={currentStation}
        nowPlayingTitle={getCurrentSongInfo()}
        getLogoUrl={getLogoUrl}
      />

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        visible={showSleepTimer}
        onClose={() => setShowSleepTimer(false)}
        onStart={handleSleepTimerStart}
        isTimerActive={sleepTimerActive}
        remainingSeconds={sleepTimerRemaining}
        onCancel={cancelSleepTimer}
        stationName={currentStation.name}
        logoUrl={logoUrl}
        fallbackLogoUrl={fallbackLogoUrl || undefined}
        trackTitle={trackText ? nowPlaying?.title || trackText : t('live_radio', 'Live Radio')}
        trackArtist={trackText ? nowPlaying?.artist || currentStation.name : currentStation.name}
        playing={isPlaying}
        favorite={isFavorite}
        onFavorite={handleToggleFavorite}
        onMore={() => setShowOptionsSheet(true)}
        previewTopInset={previewTopInset}
      />

      {/* Player Options Sheet */}
      <PlayerOptionsSheet
        visible={showOptionsSheet}
        onClose={() => setShowOptionsSheet(false)}
        station={currentStation}
        trackAvailable={!!trackText}
        unavailableMessage={unavailableMessage}
        onSpotify={() => openTrackPlatform('spotify')}
        onYoutube={() => openTrackPlatform('youtube')}
        onAppleMusic={() => openTrackPlatform('appleMusic')}
        onSoundcloud={() => openTrackPlatform('soundcloud')}
        onDeezer={() => openTrackPlatform('deezer')}
        onAirplay={isAirplayAvailable ? () => { void showAirplayPicker().catch(() => showCastNotice(t('cast_connection_failed', 'Could not connect. Please try again.'))); } : undefined}
        onShare={() => setShowShareModal(true)}
      />

      {playerNotice && <ProfilePhotoFeedback notice={playerNotice} onDismiss={dismissPlayerNotice} />}

      {/* Premium Paywall */}
      <PremiumPaywall
        source="player"
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        mode={paywallMode}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Figma screen-looked2293:8640:302×170,radius6,black fill/#292929 border.
  lockOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  lockDialog: { width: 302, maxWidth: '90%', minHeight: 170, borderRadius: 6, borderWidth: 1, borderColor: '#292929', backgroundColor: '#000000', paddingHorizontal: 20, paddingVertical: 30, alignItems: 'center', justifyContent: 'center' },
  lockDialogIcon: { width: 24, height: 24, marginBottom: 24 },
  lockDialogTitle: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 20, lineHeight: 23, textAlign: 'center' },
  lockDialogHint: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  lockNotice: { position: 'absolute', alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, backgroundColor: '#282828' },
  lockNoticeText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 18, textAlign: 'center' },
  playerGlowLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  playerBackground: { position: 'absolute', left: -234, width: 844, height: 844 },
  playerHeaderShade: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.135)' },
  mainPlaybackIcon: { width: 42, height: 42 },
  skipIcon: { width: 30, height: 30 },
  premiumBanner: { height: 54, borderRadius: 5, overflow: 'hidden', marginHorizontal: 16, marginBottom: 24 },
  premiumGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  premiumIcon: { width: 30, height: 30 },
  premiumTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 14, lineHeight: 19, color: '#FFFFFF' },
  premiumSubtitle: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  figmaIcon: { width: 24, height: 24 },
  socialLogo: { width: 30, height: 30 },
  equalizerSlot: { height: 26, alignItems: 'center' },
  gridCity: { fontFamily: 'Ubuntu-Regular' },
  container: {
    flex: 1,
    backgroundColor: '#131313',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Header
  headerContainer: {
    width: '100%',
    height: 60,
    backgroundColor: 'transparent',
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    minWidth: 0,
    paddingLeft: 8,
  },
  hdShortcut: { minHeight: 44, justifyContent: 'center' },
  hdBadge: {
    backgroundColor: '#FF9945',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hdText: {
    fontSize: 7,
    lineHeight: 10,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  offlineContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  // Artwork
  artworkContainer: {
    alignItems: 'center',
    marginTop: 43,
    marginBottom: 30,
  },
  artworkConnecting: { alignItems: 'center', justifyContent: 'center' },
  artworkWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    position: 'relative',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryFlagContainer: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderColor: '#FFFFFF',
  },
  countryFlag: {
    width: '100%',
    height: '100%',
  },

  // Now Playing
  nowPlayingSection: {
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 20,
  },
  animatedDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotPink: {
    backgroundColor: '#FF4D8D',
  },
  stationName: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  artistName: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Ubuntu-Medium',
  },
  communitySummary: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  voteSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 44, width: 230, maxWidth: '100%', marginBottom: 18 },
  voteHairline: { flex: 1, height: 1, opacity: 0.65 },
  // Premium-gated song info
  lockedSongInfo: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  blurredTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  blurredText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.15)',
    fontFamily: 'Ubuntu-Medium',
    letterSpacing: 2,
  },
  premiumUnlockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,65,153,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,65,153,0.25)',
  },
  premiumUnlockText: {
    fontSize: 10,
    fontFamily: 'Ubuntu-Bold',
    color: '#FF4199',
  },
  // Locked social buttons
  lockedSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockedSocialButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  // Go Premium Banner
  socialIcons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  socialButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconSlot: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Main Controls
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 22,
    maxWidth: 375,
    width: '100%',
    alignSelf: 'center',
  },
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerOnBadge: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    backgroundColor: '#87CD56',
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 3,
  },
  timerOnText: {
    fontSize: 7,
    lineHeight: 10,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
  skipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#242424',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
  },
  playPauseButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2F2F2F',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 0,
  },

  // Secondary Controls
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  leftSecondaryControls: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  section: {
    paddingHorizontal: GRID_PADDING,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  stationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },

  // Grid Items - sizes are set dynamically in the component
  gridItem: {
    marginBottom: 24,
  },
  gridImageWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    marginBottom: 8,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  gridStationName: {
    fontSize: 14,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
  gridStationLocation: {
    fontSize: 12,
    color: '#B8B9BF',
    marginTop: 2,
    fontFamily: 'Ubuntu-Bold',
  },

  // Same surface, typography and recovery treatment as SharedLinkState.
  emptyPage: { flex: 1, backgroundColor: '#1B1C1E' },
  emptyHeader: { height: 78, paddingHorizontal: 5, justifyContent: 'center' },
  emptyBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 78 },
  emptyCard: { width: '100%', maxWidth: 344, backgroundColor: '#000000', borderColor: '#292929', borderWidth: 1, borderRadius: 6, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center' },
  emptyTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 20, lineHeight: 25, color: '#FFFFFF', marginTop: 24, textAlign: 'center' },
  emptyText: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 21, color: '#B7B7BF', marginTop: 12, textAlign: 'center' },
  goBackButton: { backgroundColor: '#FF3494', minHeight: 44, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 6, marginTop: 28 },
  goBackButtonText: { fontFamily: 'Ubuntu-Bold', fontSize: 15, color: '#FFFFFF' },
});

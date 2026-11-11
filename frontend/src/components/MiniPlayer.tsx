import { miniPlayerGlowGeometry, miniPlayerFailureLabel, miniPlayerOfflineLabel, miniPlayerFailureKind } from '../utils/miniPlayerPresentation';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useEffect, useMemo, useRef, useId, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder} from 'react-native';
import { ImageWithFallback } from './ImageWithFallback';
import { Image } from 'expo-image';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useLogoAccent } from '../hooks/useLogoAccent';
import { useTranslation } from 'react-i18next';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../store/playerStore';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useFavoritesStore } from '../store/favoritesStore';
import { currentTrackText } from '../utils/nowPlaying';
import { getStationLogoUrl } from '../utils/stationLogoHelper';

import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NetInfo from '@react-native-community/netinfo';
import { reportStationIssue } from '../services/stationIssueReporter';
import { ProfilePhotoFeedback } from './ProfilePhotoFeedback';

const MINI_PLAYER_HEIGHT = 71;
const icons = {
  expand: require('../../assets/images/mini-player/expand.svg'),
  play: require('../../assets/images/mini-player/play.svg'),
  pause: require('../../assets/images/mini-player/pause.svg'),
  heart: require('../../assets/images/mini-player/heart.svg'),
  heartFilled: require('../../assets/images/mini-player/heart-filled.svg'),
};

interface MiniPlayerProps {
  isGlobal?: boolean; // If true, position at bottom: 0 (for non-tab screens)
  floating?: boolean;
  compact?: boolean;
  onControlPressIn?:()=>void;
  suppressSurfacePress?:()=>boolean;
  docked?: boolean; // In normal flow directly above the tab bar.
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ isGlobal = false, docked = false, floating = false, compact = false, onControlPressIn, suppressSurfacePress }) => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const glow = miniPlayerGlowGeometry(compact);
  const {previewMini}=useGlobalSearchParams<{previewMini?:string}>();
  const preview=__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1';
  const {isOffline}=useNetworkStatus();
  const forcedOffline=preview&&previewMini==='offline';
  const [report,setReport]=useState<{id:string;status:'sending'|'sent'}|null>(null);
  const [playerTop,setPlayerTop]=useState<number|null>(null);
  const [notice,setNotice]=useState<{error:boolean;message:string}|null>(null);
  const clearNotice=useCallback(()=>setNotice(null),[]);
  const mounted=useRef(true),reportBusy=useRef(new Set<string>());
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const insets = useSafeAreaInsets();
  const {
    currentStation,
    playbackState,
    nowPlaying,
    isMiniPlayerVisible,
  } = usePlayerStore();
  
  // Calculate tab bar height including system navigation bar for Android
  // Tab bar height: iOS=85, Android=65 + system nav bar inset
  const systemNavBarHeight = Platform.OS === 'android' ? insets.bottom : 0;
  const baseTabBarHeight = Platform.OS === 'ios' ? 85 : 65;
  const tabBarHeight = baseTabBarHeight + systemNavBarHeight;
  
  // For global (non-tab) screens, add safe area bottom padding for BOTH platforms
  const globalBottomPadding = insets.bottom;
  
  // Use the shared audio player hook - get all functions at once
  const { togglePlayPause, stopPlayback } = useAudioPlayer();
  
  // Favorites store
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  
  // Check if current station is favorited
  const isCurrentFavorite = currentStation ? isFavorite(currentStation._id) : false;

  const dragY = useRef(new Animated.Value(0)).current;
  const collapse = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);
  const suppressPressUntil = useRef(0);
  const reduceMotion = useRef(false);
  const heldSurface=useRef(false);
  const surfacePressProps=floating?{delayLongPress:300,onPressIn:()=>{heldSurface.current=false;},onLongPress:()=>{heldSurface.current=true;}}:{};
  const contentHeight=compact?56:MINI_PLAYER_HEIGHT;
  const playerHeight = contentHeight + (isGlobal && !floating ? globalBottomPadding : 0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduceMotion.current = value; }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    dragY.stopAnimation(); collapse.stopAnimation();
    dragY.setValue(0); collapse.setValue(0); dismissing.current = false;
    return () => { dragY.stopAnimation(); collapse.stopAnimation(); };
  }, [currentStation?._id, isMiniPlayerVisible, dragY, collapse]);

  const dismissPlayer = useCallback(() => {
    const owner = currentStation?._id;
    if (!owner || dismissing.current || usePlayerStore.getState().currentStation?._id !== owner) return;
    dismissing.current = true;
    suppressPressUntil.current = Date.now() + 300;
    const duration = reduceMotion.current ? 0 : 180;
    Animated.parallel([
      Animated.timing(dragY, { toValue: playerHeight, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(collapse, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (!finished || usePlayerStore.getState().currentStation?._id !== owner) return;
      // Stop audio as well as hiding the UI. Keep saved listening history intact.
      void stopPlayback().catch(error => console.error('[MiniPlayer] Stop error:', error));
      usePlayerStore.getState().hideMiniPlayer();
    });
  }, [currentStation?._id, stopPlayback, dragY, collapse, playerHeight]);

  const springBack = useCallback(() => {
    suppressPressUntil.current = Date.now() + 250;
    Animated.spring(dragY, { toValue: 0, speed: 24, bounciness: 0, useNativeDriver: false }).start();
  }, [dragY]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => !dismissing.current && gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx) * 1.3,
    onPanResponderGrant: () => { dragY.stopAnimation(); suppressPressUntil.current = Date.now() + 250; },
    onPanResponderMove: (_, gesture) => { dragY.setValue(Math.min(playerHeight, Math.max(0, gesture.dy))); },
    onPanResponderRelease: (_, gesture) => {
      suppressPressUntil.current = Date.now() + 250;
      if (gesture.dy >= 42 || (gesture.dy >= 18 && gesture.vy > 0.65)) dismissPlayer();
      else springBack();
    },
    onPanResponderTerminate: springBack,
    onPanResponderTerminationRequest: () => false,
  }), [dismissPlayer, springBack, dragY, playerHeight]);
  const dismissAction = [{ name: 'dismiss', label: t('close_player', 'Stop and close player') }];
  const onAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'dismiss') dismissPlayer();
  };
  const webKeyboardProps = Platform.OS === 'web' ? {
    onKeyDown: (event: { key: string; stopPropagation: () => void; preventDefault: () => void }) => {
      if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); dismissPlayer(); }
    },
  } : {};

  const logoUrl = getStationLogoUrl(currentStation);
  const logoAccent = useLogoAccent(logoUrl);
  const glowId = useId().replace(/:/g, '');

  const networkError=useRef<{id?:string;offline:boolean}>({offline:false});
  if(networkError.current.id!==currentStation?._id||['idle','loading','playing','paused'].includes(playbackState))networkError.current={id:currentStation?._id,offline:false};
  if((isOffline||forcedOffline)&&playbackState==='error')networkError.current.offline=true;
  const failureKind=miniPlayerFailureKind(playbackState,isOffline||forcedOffline,networkError.current.offline);
  const isError=!!failureKind;
  const isStationError=failureKind==='station';
  const reportStatus=report?.id===currentStation?._id?report?.status:'idle';

  // Early return AFTER all hooks
  if (!isMiniPlayerVisible || !currentStation) {
    return null;
  }

  // Get logo URL using shared utility - use local fallback if no URL or error
  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading' || playbackState === 'buffering';

  // Get genre/category from station
  const getGenre = () => {
    if (currentStation.tags && typeof currentStation.tags === 'string') {
      return currentStation.tags.split(',')[0].trim();
    }
    if (currentStation.genres && Array.isArray(currentStation.genres) && currentStation.genres.length > 0) {
      return currentStation.genres[0];
    }
    return currentStation.country || 'Radio';
  };

  const handlePress = () => {
    if(heldSurface.current){heldSurface.current=false;return;}
    if (dismissing.current || Date.now() < suppressPressUntil.current || suppressSurfacePress?.()) return;
    router.push(preview&&forcedOffline?'/player?preview=1&failure=offline':'/player');
  };

  const handlePlayPause = async () => {
    if (dismissing.current || Date.now() < suppressPressUntil.current) return;
    try {
      // Let the audio engine inspect its real source/queue, including a stale paused UI.
      // A direct resume() cannot restart an empty media element after provider recreation.
      await togglePlayPause();
    } catch (error) {
      console.error('[MiniPlayer] Play/Pause error:', error);
    }
  };

  const handleReport = async () => {
    if(!isStationError||!currentStation||reportStatus!=='idle'||reportBusy.current.has(currentStation._id))return;
    const station={...currentStation},id=station._id;
    reportBusy.current.add(id);setReport({id,status:'sending'});
    try{
      const online=Platform.OS==='web'?navigator.onLine:await NetInfo.fetch().then(n=>n.isConnected!==false&&n.isInternetReachable!==false);
      if(!online){if(mounted.current)setReport(null);return;}
      const result=preview&&previewMini==='error'?'preview':await reportStationIssue({station,message:usePlayerStore.getState().errorMessage,platform:Platform.OS,language:i18n.language});
      if(mounted.current&&usePlayerStore.getState().currentStation?._id===id){setReport({id,status:'sent'});setNotice({error:false,message:t(result==='already'?'player_report_already':'player_report_thanks')});}
    }catch{if(mounted.current&&usePlayerStore.getState().currentStation?._id===id){setReport(null);setNotice({error:true,message:t('player_report_failed')});}}
    finally{reportBusy.current.delete(id);}
  };

  const handleFavorite = async () => {
    if (dismissing.current || Date.now() < suppressPressUntil.current) return;
    console.log('[MiniPlayer] handleFavorite called');
    if (currentStation) {
      console.log('[MiniPlayer] Calling toggleFavorite for station:', currentStation._id);
      try {
        await toggleFavorite(currentStation);
        console.log('[MiniPlayer] toggleFavorite completed successfully');
      } catch (err) {
        console.error('[MiniPlayer] toggleFavorite error:', err);
      }
    } else {
      console.log('[MiniPlayer] No currentStation available');
    }
  };
  
  return (
    <>
    <Animated.View testID="mini-player" onLayout={event=>{const y=event.nativeEvent.layout.y;setPlayerTop(previous=>previous===y?previous:y);}} {...(floating ? {} : panResponder.panHandlers)} {...webKeyboardProps} onAccessibilityEscape={dismissPlayer} style={[
      styles.container, 
      { 
        position: docked || floating ? 'relative' : 'absolute',
        backgroundColor:floating?'transparent':'#222222',
        // Overlap the scene by the corner radius so its content shows through the rounded corners.
        marginTop: docked ? -10 : 0,
        bottom: docked || floating || isGlobal ? 0 : tabBarHeight,
        // Add extra height for safe area when in global mode on iOS
        height: collapse.interpolate({ inputRange: [0, 1], outputRange: [playerHeight, 0] }),
        opacity: collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        overflow: 'hidden',
        paddingBottom: collapse.interpolate({ inputRange: [0, 1], outputRange: [isGlobal && !floating ? globalBottomPadding : 0, 0] }),
      },
      isGlobal && styles.containerGlobal
    ]}>
      <Animated.View style={[styles.content, {height:contentHeight,paddingRight:compact?8:15}, { transform: [{ translateY: dragY }] }]}>
        {floating && <TouchableOpacity testID="mini-player-close" onPressIn={onControlPressIn} onPress={dismissPlayer} accessibilityRole="button" accessibilityLabel={t('close_player','Oynatıcıyı kapat')} style={{width:compact?30:40,height:44,alignItems:'center',justifyContent:'center'}}><Text style={styles.closeIcon}>×</Text></TouchableOpacity>}
        {/* Chevron Up Button */}
        {!compact&&!floating&&<TouchableOpacity onPressIn={onControlPressIn} style={styles.chevronButton} onPress={handlePress} accessibilityRole="button" accessibilityLabel={t('open_player', 'Open player')} testID="mini-player-expand" accessibilityActions={dismissAction} onAccessibilityAction={onAccessibilityAction} onAccessibilityEscape={dismissPlayer} accessibilityHint={floating ? t('mini_player_move_hint','Use the handle to move the player.') : t('mini_player_dismiss_hint', 'Swipe down to stop and close the player.')}>
          <Image source={icons.expand} style={styles.icon} contentFit="contain" tintColor="#FFFFFF" />
        </TouchableOpacity>}

        {/* Station Logo - Tappable to open player */}
        <View style={{ width: glow.logoSize, height: glow.logoSize, flexShrink: 0 }}>
        {/* Color-only halo: no second artwork, no rectangular blur surface. */}
        {logoAccent && !isLoading && !isError && <Svg testID="mini-player-logo-glow" width={glow.width} height={glow.height} style={[styles.logoGlow, { left: glow.left, top: glow.top }]} pointerEvents="none" accessible={false}>
          <Defs><RadialGradient id={glowId} cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={logoAccent} stopOpacity={0.16} /><Stop offset="0.45" stopColor={logoAccent} stopOpacity={0.07} /><Stop offset="1" stopColor={logoAccent} stopOpacity={0} /></RadialGradient></Defs>
          <Ellipse cx={glow.width / 2} cy={glow.height / 2} rx={glow.width / 2} ry={glow.height / 2} fill={`url(#${glowId})`} />
        </Svg>}
        <TouchableOpacity {...surfacePressProps} style={[styles.logoContainer, compact&&{width:36,height:36}, isError && styles.errorLogo]} onPress={handlePress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={currentStation.name} accessibilityActions={dismissAction} onAccessibilityAction={onAccessibilityAction} onAccessibilityEscape={dismissPlayer} accessibilityHint={floating ? t('mini_player_move_hint','Use the handle to move the player.') : t('mini_player_dismiss_hint', 'Swipe down to stop and close the player.')}>
          {isError ? <View testID="mini-player-error-icon" style={styles.errorIconContainer}>
            <Image source={require('../../assets/images/player/broadcast.svg')} style={styles.errorIcon} tintColor={isStationError?"#FF4199":"#B6B6BC"} contentFit="contain" accessible={false} />
          </View> : isLoading ? <View testID="mini-player-connecting" style={styles.connectingLogo} accessibilityRole="progressbar" accessibilityLabel={t('connecting', 'Connecting…')}><ActivityIndicator color="#FF4199" size="small" /></View> : <ImageWithFallback
            testID="mini-player-station-logo"
            uri={logoUrl}
            style={styles.logo} 
            contentFit="cover"
            cachePolicy="memory-disk"
          />}
        </TouchableOpacity>

        </View>

        {/* Station Info - Tappable to open player */}
        <TouchableOpacity {...surfacePressProps} style={styles.info} onPress={handlePress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={currentStation.name} accessibilityActions={dismissAction} onAccessibilityAction={onAccessibilityAction} onAccessibilityEscape={dismissPlayer} accessibilityHint={floating ? t('mini_player_move_hint','Use the handle to move the player.') : t('mini_player_dismiss_hint', 'Swipe down to stop and close the player.')}>
          <Text style={[styles.stationName,compact&&{fontSize:13,lineHeight:16}]} numberOfLines={1}>
            {currentStation.name}
          </Text>
          <Text style={[styles.genreText,compact&&{fontSize:11,lineHeight:14,marginTop:3}, isError && styles.errorMessage]} numberOfLines={1} accessibilityLiveRegion="polite">
            {isError ? isStationError ? miniPlayerFailureLabel(i18n.language) : failureKind==='reconnect' ? t('retry','Try again') : miniPlayerOfflineLabel(i18n.language) : isLoading ? t('connecting', 'Connecting…') : currentTrackText(nowPlaying, currentStation.name, currentStation.country) || getGenre()}
          </Text>
        </TouchableOpacity>

        {/* Controls */}
        <View style={styles.controls} onStartShouldSetResponderCapture={()=>{onControlPressIn?.();return false;}}>
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={[styles.controlButton,isStationError&&styles.reportButton]}
            disabled={isStationError?reportStatus!=='idle':failureKind==='offline'}
            accessibilityState={{disabled:isStationError?reportStatus!=='idle':failureKind==='offline',busy:isStationError&&reportStatus==='sending'}}
            onPressIn={onControlPressIn}
            onPress={isStationError?handleReport:handlePlayPause}
            testID={isStationError?'mini-player-report':'mini-player-play-pause'}
            accessibilityLabel={isStationError?t('player_report_this','Report this'):failureKind==='offline'?miniPlayerOfflineLabel(i18n.language):isError ? t('retry', 'Try again') : isPlaying || isLoading ? t('pause', 'Pause') : t('play', 'Play')}
            hitSlop={2}
            accessibilityRole="button"
          >
            {isStationError ? reportStatus==='sending'?<ActivityIndicator size="small" color="#FF4199"/>:<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.reportLabel}>{t(reportStatus==='sent'?'player_report_sent':'mini_player_report',reportStatus==='sent'?'Reported ✓':'Report')}</Text> : isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : <Image source={isPlaying ? icons.pause : icons.play} style={styles.icon} contentFit="contain" tintColor={failureKind==='offline'?"#77777C":"#FFFFFF"} />}
          </TouchableOpacity>

          {/* Favorite Button */}
          {!compact&&<TouchableOpacity onPressIn={onControlPressIn}
            style={styles.controlButton}
            onPress={isError ? dismissPlayer : handleFavorite}
            testID={isError ? 'mini-player-error-close' : 'mini-player-favorite'}
            accessibilityLabel={isError ? t('close_player', 'Stop and close player') : t('toggle_favorite', 'Toggle Favorite')}
            accessibilityState={isError ? {} : { selected: isCurrentFavorite }}
            hitSlop={2}
            accessibilityRole="button"
          >
            {isError ? <Text style={styles.closeIcon} accessible={false}>×</Text> : <Image source={isCurrentFavorite ? icons.heartFilled : icons.heart} style={styles.icon} contentFit="contain" tintColor={isCurrentFavorite ? '#FF4199' : '#FFFFFF'} />}
          </TouchableOpacity>}
        </View>
      </Animated.View>
    </Animated.View>
    {notice&&<View pointerEvents="box-none" style={{position:'absolute',left:0,right:0,top:playerTop??0,height:0,zIndex:101}}><ProfilePhotoFeedback notice={notice} onDismiss={clearNotice}/></View>}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // bottom is set dynamically via inline style
    left: 0,
    right: 0,
    height: MINI_PLAYER_HEIGHT,
    backgroundColor: '#222222',
    borderTopWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  containerGlobal: {
    // bottom: 0 is handled inline
  },
  content: {
    height: MINI_PLAYER_HEIGHT,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 15,
  },
  reportButton:{width:80,flexShrink:0,paddingHorizontal:6,borderRadius:6,backgroundColor:'#292A2D',minHeight:44},
  reportLabel:{fontFamily:'Ubuntu-Medium',fontSize:12,lineHeight:16,color:'#FFFFFF',textAlign:'center'},
  errorLogo: { backgroundColor: '#292A2D', borderRadius: 5, borderWidth: 1, borderColor: '#3B3C40' },
  errorIconContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorIcon: { width: 24, height: 24 },
  connectingLogo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorMessage: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 16, marginTop: 5, color: '#B6B6BC' },
  closeIcon: { color: '#FFFFFF', fontFamily: 'Ubuntu-Regular', fontSize: 28, lineHeight: 30 },
  logoGlow: { position: 'absolute' },
  chevronButton: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#2F2F2F',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  placeholderLogo: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2F2F2F',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    minWidth: 0,
  },
  stationName: {
    fontSize: 15,
    lineHeight: 17,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
  genreText: {
    fontSize: 14,
    lineHeight: 16,
    fontFamily: 'Ubuntu-Light',
    color: '#FFFFFF',
    marginTop: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 24, height: 24 },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MiniPlayer;

import {previewSafeArea} from '../../src/utils/previewSafeArea';
import { useHomeStationCatalog } from '../../src/hooks/useHomeStationCatalog';
import {MegaRefreshControl as RefreshControl} from '../../src/components/MegaRefreshControl';
import { DEFAULT_STATION_LOGO_SOURCE } from '../../src/utils/stationLogoHelper';
import { MegaLoadingIndicator as ActivityIndicator } from '../../src/components/MegaLoadingIndicator';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,

  Animated,
  Platform,
  Linking} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { typography } from '../../src/constants/theme';
import {MegaLoadingState} from '../../src/components/MegaLoadingState';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';
import {ProfilePhotoFeedback} from '../../src/components/ProfilePhotoFeedback';
import { CountryDiscoveryIcon } from '../../src/components/BrandIcons';
import { DiscoverableGenreArtwork } from '../../src/components/DiscoverableGenreArtwork';
import { AvatarWithFallback } from '../../src/components/AvatarWithFallback';
import { useResponsive } from '../../src/hooks/useResponsive';
import {
  usePopularStations,
  usePrecomputedGenres,
  useDiscoverableGenres,
  useRecentlyPlayed,
  usePublicProfiles,
  useNearbyStations,
} from '../../src/hooks/useQueries';
import { notificationQueryOptions } from '../../src/services/notificationQueries';
import { preloadUserFavorites } from '../../src/services/preloadService';
import { useAudioPlayer } from '../../src/hooks/useAudioPlayer';
import { usePlayerStore } from '../../src/store/playerStore';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { useRecentlyPlayedStore } from '../../src/store/recentlyPlayedStore';
import { usePremiumStore } from '../../src/store/premiumStore';
import { PremiumPaywall } from '../../src/components/PremiumPaywall';
import type { Station, Genre } from '../../src/types';
import { getStationLogoUrl } from '../../src/utils/logoUtils';
import { shouldShowNearbyLocationPrompt } from '../../src/utils/nearbyScope';
import { mergeRecentlyPlayed } from '../../src/utils/recentlyPlayed';
import { isGlobalCountry } from '../../src/utils/countryScope';
import { useHomeProfileDiscovery } from '../../src/hooks/useHomeProfileDiscovery';
import { useHomePopularStations } from '../../src/hooks/useHomePopularStations';

const FALLBACK_LOGO = DEFAULT_STATION_LOGO_SOURCE;


export default function HomeScreen() {
  const homeScrollY = useRef(new Animated.Value(0)).current;
  const homeScrollOffset = useRef(0);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'home', visible, scrollY: homeScrollOffset.current }, 'http://localhost:8082');
      notify(true);
      return () => notify(false);
    }
  }, []));
  const router = useRouter();
  const { previewNearby, previewMini } = useLocalSearchParams<{ previewNearby?: string; previewMini?: string }>();
  const previewNearbyEnabled = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && ['AT', 'DE', 'vienna'].includes(previewNearby || '');
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isPremium = usePremiumStore(state => state.isPremium);
  const [showPaywall, setShowPaywall] = useState(false);
  const { countryCode, country, countryEnglish, latitude, longitude, nearbyCountryEnglish, nearbyCountryCode, fetchLocation, isLoaded,permission,canAskAgain,loading:locationLoading } = useLocationStore();

  const [locationNotice,setLocationNotice]=useState<{error:boolean;message:string}|null>(null);
  const dismissLocationNotice=useCallback(()=>setLocationNotice(null),[]);
  const handleNearbyLocation=async()=>{
    if(locationLoading)return;
    if(permission==='denied'&&(Platform.OS==='web'||!canAskAgain)){
      if(Platform.OS==='web')setLocationNotice({error:true,message:t('nearby_permission_browser_short')});
      else await Linking.openSettings().catch(()=>setLocationNotice({error:true,message:t('nearby_permission_settings_short')}));
      return;
    }
    await fetchLocation({requestPermission:true});
    const state=useLocationStore.getState();
    if(state.permission==='denied')setLocationNotice({error:true,message:t(Platform.OS==='web'?'nearby_permission_browser_short':'nearby_permission_settings_short')});
    else if(state.error)setLocationNotice({error:true,message:t(state.error==='services-disabled'?'nearby_services_disabled_short':'nearby_location_failed_short')});
  };

  const isMiniPlayerVisible = usePlayerStore(state => state.isMiniPlayerVisible);
  const currentStation = usePlayerStore(state => state.currentStation);
  const playbackState = usePlayerStore(state => state.playbackState);

  // Use responsive hook for tablet support
  const responsive = useResponsive();
  const gridMetrics = responsive.getGridMetrics();
  // The phone design uses three 100px artworks separated by generous gutters.
  const homeGridGap = responsive.isTablet ? gridMetrics.gap : 24;
  const homeGridWidth = Math.floor((responsive.width - responsive.sidePadding * 2 - homeGridGap * (gridMetrics.columns - 1)) / gridMetrics.columns);

  // Calculate responsive values
  const sidePadding = responsive.sidePadding;
  const genreCardWidth = responsive.isTablet ? responsive.genreCardWidth : (responsive.width - sidePadding) * 130 / 360;
  const genreArtworkScale = genreCardWidth / 130;
  const genreArtwork = [
    { source: require('../../assets/images/home/genre-folk-source.png'), left: -105, top: -48, width: 278, height: 186 },
    { source: require('../../assets/images/home/genre-slow-source.png'), left: -44, top: -55, width: 342, height: 256 },
    { source: require('../../assets/images/home/genre-jazz-source.png'), left: -34, top: -21, width: 198, height: 132 },
  ];
  const genreCardHeight = responsive.genreCardHeight;
  const genreImageScale = Math.max(genreArtworkScale, genreCardHeight / 45);
  const bannerWidth = responsive.isTablet ? responsive.bannerWidth : responsive.width - sidePadding * 2 - 14;
  const bannerHeight = responsive.isTablet ? responsive.bannerHeight : 120;
  const headingSize = Math.round(18 * responsive.headingScale);

  // Dock reserves player height; compensate only its 10px rounded-corner overlap.
  const scrollBottomPadding = 16 + (isMiniPlayerVisible && currentStation ? 10 : 0);

  // Handle notification icon press
  const handleNotificationPress = useCallback(() => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push({
        pathname: '/auth-options',
        params: {
          returnTo: '/notifications',
          returnParams: JSON.stringify({})
        }
      });
    } else {
      router.push('/notifications');
    }
  }, [isAuthenticated, router]);

  // Recently played from local storage
  const localRecentStations = useRecentlyPlayedStore(state => state.stations);
  const recentLoaded = useRecentlyPlayedStore(state => state.loaded);
  const loadRecent = useRecentlyPlayedStore(state => state.loadFromStorage);
  useEffect(() => { loadRecent(); }, []);

  // Calculate grid item width dynamically using responsive hook
  const gridGap = homeGridGap;
  const gridItemWidth = homeGridWidth;

  // API calls use different country formats:
  // - /api/stations/popular: accepts both English and native names
  // - /api/genres/:slug/stations: requires English name only
  // - /api/genres/precomputed: accepts native names
  // - /api/stations: requires English name (e.g., "Austria" not "Österreich")
  // Using countryEnglish for all API calls for consistency
  // Cache the top 20 for each country; display four per Home visit.
  // IMPORTANT: Wait for country to load before making API calls to prevent race condition
  const countryForApi = isLoaded ? (countryEnglish || country || undefined) : undefined;

  const { data: popularData, isLoading: popularLoading, refetch: refetchPopular } = usePopularStations(countryForApi, 20, isLoaded, !countryForApi || isGlobalCountry(countryForApi));
  const { stations: popularStations, rotate: rotatePopular } = useHomePopularStations(countryForApi || 'global', popularData?.stations, isLoaded);
  const { data: genresData, isLoading: genresLoading, refetch: refetchGenres } = usePrecomputedGenres(countryForApi, isLoaded);
  const { data: discoverableGenres, refetch: refetchDiscoverable } = useDiscoverableGenres();
  const { data: recentlyPlayedData, isLoading: recentLoading, refetch: refetchRecent } = useRecentlyPlayed();
  const { data: publicProfiles, isLoading: publicProfilesLoading, refetch: refetchProfiles } = usePublicProfiles(40);
  const { profiles: discoveryProfiles, rotate: rotateProfiles, loading: profileDiscoveryLoading } = useHomeProfileDiscovery(publicProfiles, isAuthenticated ? user?._id || user?.id || 'guest' : 'guest', responsive.isTablet ? 8 : 6);
  // Use a public photo only in the opt-in local browser design preview.
  const previewAvatar = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1'
    ? publicProfiles?.find((profile: any) => profile.profileImageUrl || profile.avatar)
    : undefined;
  // FIXED: Use countryForApi (English name) for stations list API - "Austria" not "Österreich"
  const { stations: allStations, isLoading: allStationsLoading, refetch: refetchAll, rejectLogo: rejectCatalogLogo } = useHomeStationCatalog(countryForApi, isLoaded, responsive.isTablet ? 25 : 21);

  // Local visual QA only: no playback request, history write or selection analytics.
  const miniPreviewStation = allStations[0];
  useEffect(() => {
    if (!(__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') || !['error', 'offline', 'paused'].includes(previewMini || '') || !miniPreviewStation) return;
    const previous = usePlayerStore.getState();
    const snapshot = { currentStation: previous.currentStation, playbackState: previous.playbackState, isMiniPlayerVisible: previous.isMiniPlayerVisible, nowPlaying: previous.nowPlaying };
    usePlayerStore.setState({ currentStation: miniPreviewStation, playbackState: previewMini === 'paused' ? 'paused' : 'error', isMiniPlayerVisible: true, nowPlaying: null });
    return () => { usePlayerStore.setState(snapshot); };
  }, [previewMini, miniPreviewStation?._id]);

  // Nearby stations - 50km radius
  const { data: nearbyData, isLoading: nearbyLoading, isError: nearbyError, refetch: refetchNearby } = useNearbyStations(
    previewNearbyEnabled ? previewNearby === 'vienna' ? 48.2082 : null : latitude,
    previewNearbyEnabled ? previewNearby === 'vienna' ? 16.3738 : null : longitude,
    50, 12, previewNearbyEnabled ? previewNearby === 'DE' ? 'Germany' : 'Austria' : nearbyCountryEnglish || countryForApi, isLoaded
  );

  const { playStation } = useAudioPlayer();
  const refreshLock = useRef(false);
  const onRefresh = useCallback(async () => {
    if (refreshLock.current || !isLoaded) return;
    refreshLock.current = true;
    setRefreshing(true);
    rotatePopular();
    rotateProfiles();
    try {
      await Promise.allSettled([
        refetchPopular(), refetchGenres(), refetchDiscoverable(),
        ...(isAuthenticated ? [refetchRecent()] : []),
        refetchProfiles(), refetchAll(), refetchNearby(),
      ]);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }, [isLoaded, isAuthenticated, rotatePopular, rotateProfiles, refetchPopular, refetchGenres, refetchDiscoverable, refetchRecent, refetchProfiles, refetchAll, refetchNearby]);

  const handleStationPress = (station: Station) => {
    playStation(station);
  };

  const handleGenrePress = (genre: Genre) => {
    // Navigate directly to genre-detail page
    router.push({
      pathname: '/genre-detail',
      params: { slug: genre.slug, name: genre.name },
    });
  };

  // Sort genres by station count (most popular first) then take first 16
  const genres = useMemo(() => {
    const allGenres = isLoaded ? genresData?.data || [] : [];
    return [...allGenres]
      .sort((a, b) => (b.stationCount || b.total_stations || 0) - (a.stationCount || a.total_stations || 0))
      .slice(0, 16);
  }, [genresData, isLoaded]);
  const recentStations = useMemo(() => {
    const serverStations = isAuthenticated && Array.isArray(recentlyPlayedData) ? recentlyPlayedData : [];
    return mergeRecentlyPlayed(localRecentStations, serverStations);
  }, [localRecentStations, recentlyPlayedData, isAuthenticated]);
  const [activeDiscoveryBanner, setActiveDiscoveryBanner] = useState(0);
  const discoverableGenresList = ['news', 'jazz', 'talk', 'folk'].map(slug => {
    const catalog = [...(discoverableGenres || []), ...(genresData?.data || [])];
    const genre = catalog.find(item => item.slug === slug);
    return { ...genre, _id: genre?._id || `home-${slug}`, slug, name: t(`home_banner_${slug}`) };
  });
  const nearbyStations = !isLoaded ? [] : Array.isArray(nearbyData) ? nearbyData : (nearbyData?.stations || []);

  const icons = {
    search: require('../../assets/images/home/search.svg'),
    notification: require('../../assets/images/home/notification.svg'),
    premium: require('../../assets/images/home/premium.svg'),
    play: require('../../assets/images/mini-player/play.svg'),
    pause: require('../../assets/images/mini-player/pause.svg'),
  };
  const sectionHeading = (title: string, onSeeAll?: () => void, isGenre = false) => (
    <View style={[styles.sectionHeader, isGenre && { marginBottom: 21 }]}>
      <Text style={[styles.sectionTitle, { fontSize: headingSize }, isGenre && { lineHeight: 21 }]}>{title}</Text>
      {onSeeAll && <TouchableOpacity onPress={onSeeAll} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.seeAllText}>{t('homepage_see_all')}</Text>
      </TouchableOpacity>}
    </View>
  );
  const renderResponsiveGrid = (stations: Station[], maxItems: number, showDistance = false, onLogoError?: (station: Station) => void) => (
    <View style={[styles.stationGrid, { columnGap: gridGap }]}>
      {stations.slice(0, maxItems).map(station => (
        <TouchableOpacity key={station._id} style={[styles.gridItem, { width: gridItemWidth }]}
          onPress={() => handleStationPress(station)} accessibilityRole="button"
          accessibilityLabel={`${t('play', 'Play')} ${station.name}`}>
          <ImageWithFallback uri={getStationLogoUrl(station)} fallbackSource={FALLBACK_LOGO} onError={onLogoError ? () => onLogoError(station) : undefined}
            style={[styles.gridImage, { width: gridItemWidth, height: gridItemWidth }]} contentFit="contain" />
          <Text style={styles.stationGridName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.stationGridCountry} numberOfLines={1}>{station.country || 'Radio'}{(station.city || station.state) ? <Text style={styles.stationGridCity}>, {station.city || station.state}</Text> : null}</Text>
          {showDistance && typeof (station as any).distance === 'number' && <Text style={styles.stationGridDistance}>{(station as any).distance < 1 ? `${Math.round((station as any).distance * 1000)} m` : `${(station as any).distance.toFixed(1)} km`}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
  const seeMore = (onPress: () => void, testID?: string) => (
    <TouchableOpacity style={styles.seeMoreButton} onPress={onPress} accessibilityRole="button" testID={testID}>
      <Text style={styles.seeMoreText}>{t('see_more')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.topGlow, { transform: [{ translateY: Animated.multiply(homeScrollY, -1) }] }]} pointerEvents="none">
        <Image source={require('../../assets/images/home/background-glow.svg')} style={[styles.homeGlowImage, { top: -336 - previewSafeArea().top }]} contentFit="fill" />
      </Animated.View>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: homeScrollY } } }], {
            useNativeDriver: Platform.OS !== 'web',
            listener: (event: any) => {
              homeScrollOffset.current = event.nativeEvent.contentOffset.y;
              if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
                window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'home', visible: true, scrollY: homeScrollOffset.current }, 'http://localhost:8082');
              }
            },
          })}
          contentContainerStyle={{ paddingHorizontal: sidePadding, paddingBottom: scrollBottomPadding }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF4199" />}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerLeft} activeOpacity={0.7}
              onPress={() => user ? router.push('/(tabs)/profile') : router.push('/auth-options')}
              accessibilityRole="button" accessibilityLabel={t('tab_profile', 'Profile')} testID="header-profile-btn">
              <AvatarWithFallback uri={user?.avatar || user?.profilePhoto || previewAvatar?.profileImageUrl || previewAvatar?.avatar} size={40} />
              <View style={styles.headerIdentity}>
                <Text style={styles.welcomeText} numberOfLines={1}>{t('welcome_back')}</Text>
                <Text style={styles.userName} numberOfLines={1}>{user?.name || user?.fullName || t('guest')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <Pressable style={styles.headerIcon} onPress={() => router.push('/station-country')}
                accessibilityRole="button" accessibilityLabel={t('select_country', 'Select country')} testID="country-selector-btn">
                {countryCode ? <Image source={{ uri: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png` }}
                  style={styles.flagImageHeader} contentFit="cover" /> : <CountryDiscoveryIcon size={28} />}
              </Pressable>
              <Pressable style={styles.headerIcon} onPressIn={()=>{const owner=user?._id||user?.id;if(isAuthenticated&&owner)void queryClient.prefetchQuery(notificationQueryOptions(owner));}} onPress={handleNotificationPress} testID="notifications-btn"
                accessibilityRole="button" accessibilityLabel={t('notifications', 'Notifications')}>
                <Image source={icons.notification} style={styles.headerIconImage} contentFit="contain" />
                <View style={styles.notificationDot} />
              </Pressable>
              <Pressable style={styles.headerIcon} onPress={() => router.push('/search')} testID="search-btn"
                accessibilityRole="button" accessibilityLabel={t('search', 'Search')}>
                <Image source={icons.search} style={styles.headerIconImage} contentFit="contain" />
              </Pressable>
            </View>
          </View>
          {!isPremium && <TouchableOpacity style={styles.premiumBanner} onPress={() => setShowPaywall(true)}
            activeOpacity={0.85} testID="home-premium-banner" accessibilityRole="button" accessibilityLabel="MegaRadio Premium">
            <LinearGradient colors={['#5C27F4', '#9F3FFF']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.premiumGradient}>
              <Image source={icons.premium} style={styles.premiumIcon} contentFit="contain" />
              <View style={styles.premiumCopy}>
                <Text style={styles.premiumTitle}>MegaRadio Premium</Text>
                <Text style={styles.premiumSubtitle}>{t('home_premium_subtitle', 'Unlock amazing features')}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>}
          <View style={[styles.section, styles.genreSection]}>
            {sectionHeading(t('genres'), () => router.navigate('/(tabs)/genres'), true)}
            {(!isLoaded || genresLoading) && !genres.length ? <MegaLoadingState variant="genre-strip" count={3} inset={0}/> : genres.length > 0 ?
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginRight: -sidePadding }} testID="home-genres-carousel" contentContainerStyle={[styles.genresScroll, { paddingRight: sidePadding }]}>
                {genres.map((genre, index) => <TouchableOpacity key={genre._id}
                  testID={`home-genre-card-${index}`} style={[styles.genreCard, { width: genreCardWidth, height: genreCardHeight }]}
                  onPress={() => handleGenrePress(genre)} accessibilityRole="button" accessibilityLabel={genre.name}>
                  <Image source={genreArtwork[index % 3].source} contentFit="fill" pointerEvents="none"
                    style={{ position: 'absolute', left: (genreCardWidth - 130 * genreImageScale) / 2 + genreArtwork[index % 3].left * genreImageScale, top: (genreCardHeight - 45 * genreImageScale) / 2 + genreArtwork[index % 3].top * genreImageScale, width: genreArtwork[index % 3].width * genreImageScale, height: genreArtwork[index % 3].height * genreImageScale }} />
                  <View pointerEvents="none" style={styles.genreLabel}>
                    <Text style={styles.genreCardText} numberOfLines={1}>{genre.name}</Text>
                  </View>
                </TouchableOpacity>)}
              </ScrollView> : <Text style={styles.emptyText}>{t('no_genres_found', 'No genres available')}</Text>}
          </View>
          <View style={styles.section}>
            {sectionHeading(t('popular_stations'))}
            {(!isLoaded || popularLoading) && !popularStations.length ? <MegaLoadingState variant="station-list" count={4} inset={0} style={{paddingTop:0,paddingBottom:0}}/> : popularStations.length === 0 ?
              <Text style={styles.emptyText}>{t('no_stations_found')}</Text> :
              <View style={styles.popularList}>{popularStations.map(station => {
                const active = currentStation?._id === station._id;
                const playing = active && playbackState === 'playing';
                const loading = active && (playbackState === 'loading' || playbackState === 'buffering');
                return (
                <TouchableOpacity key={station._id} style={styles.popularItem} onPress={() => handleStationPress(station)}
                  disabled={loading} testID={`home-station-${station._id}`}
                  accessibilityState={{ busy: loading, disabled: loading }}
                  accessibilityRole="button" accessibilityLabel={`${playing ? t('pause', 'Pause') : t('play', 'Play')} ${station.name}`}>
                  <ImageWithFallback uri={getStationLogoUrl(station)} fallbackSource={FALLBACK_LOGO} style={styles.popularLogo} contentFit="contain" />
                  <View style={styles.popularInfo}>
                    <Text style={styles.popularName} numberOfLines={1}>{station.name}</Text>
                    <Text style={styles.popularCountry} numberOfLines={1}>{station.country || station.countrycode || 'Radio'}{(station.city || station.state) && <Text style={styles.stationCity}>, {station.city || station.state}</Text>}</Text>
                  </View>
                  <View style={styles.playButton}>
                    {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> :
                      <Image source={playing ? icons.pause : icons.play} style={styles.playIcon} contentFit="contain" />}
                  </View>
                </TouchableOpacity>
              ); })}</View>}
          </View>
          <View style={styles.section}>
            {sectionHeading(t('homepage_recently_played'))}
            {!recentStations.length && (!recentLoaded || (isAuthenticated && recentLoading)) ? <MegaLoadingState variant="grid" columns={gridMetrics.columns} gap={homeGridGap} count={6} inset={0} availableWidth={responsive.width-sidePadding*2}/> : recentStations.length > 0 ? renderResponsiveGrid(recentStations, responsive.isTablet ? 8 : 6) :
              <Text style={styles.emptyText}>{t('no_recently_played')}</Text>}
          </View>
          <View style={styles.section}>
            {sectionHeading(t('stations_near_you'))}
            {(!isLoaded || nearbyLoading)&&nearbyStations.length===0 ? <MegaLoadingState variant="grid" columns={gridMetrics.columns} gap={homeGridGap} count={6} inset={0} availableWidth={responsive.width-sidePadding*2}/> : nearbyStations.length>0 ?
              renderResponsiveGrid(nearbyStations,responsive.isTablet?16:12,true) :
              <Text style={styles.nearbyEmptyText}>{nearbyError?t('error_loading_stations','Unable to load stations'):(permission==='granted'||(latitude!==null&&longitude!==null))?t('no_stations_found'):t('nearby_country_hint')}</Text>}
            {nearbyError?seeMore(()=>refetchNearby(),'nearby-retry-btn'):nearbyStations.length>0&&seeMore(()=>router.push({pathname:'/all-stations',params:{country:previewNearbyEnabled?previewNearby==='DE'?'Germany':'Austria':nearbyCountryEnglish||countryForApi||nearbyStations[0]?.country,countryCode:previewNearbyEnabled?previewNearby==='DE'?'DE':'AT':nearbyCountryCode||undefined}}),'nearby-see-more-btn')}
            {shouldShowNearbyLocationPrompt(permission,latitude,longitude,previewNearbyEnabled)&&<TouchableOpacity onPress={handleNearbyLocation} disabled={locationLoading} accessibilityRole="button" style={styles.locationLink} testID="enable-nearby-location-btn"><Text style={styles.locationLinkText}>{locationLoading?t('nearby_locating'):t('nearby_enable_location')}</Text></TouchableOpacity>}


          </View>


          {discoverableGenresList.length > 0 && <View testID="home-discovery-banners" style={[styles.section, { marginRight: -sidePadding, marginBottom: 32 }]}>
            <ScrollView testID="home-discovery-carousel" horizontal showsHorizontalScrollIndicator={false} snapToInterval={bannerWidth + 12} decelerationRate="fast"
              scrollEventThrottle={100} onScroll={event => { const next = Math.max(0, Math.min(3, Math.round(event.nativeEvent.contentOffset.x / (bannerWidth + 12)))); setActiveDiscoveryBanner(current => current === next ? current : next); }}
              contentContainerStyle={{ gap: 12, paddingRight: sidePadding + 14 }}>
              {discoverableGenresList.map((genre: any) => <TouchableOpacity key={genre._id}
                style={[styles.discoveryBanner, { width: bannerWidth, height: bannerHeight }]} onPress={() => handleGenrePress(genre)}
                testID={`home-discovery-${genre.slug}`} accessibilityRole="button" accessibilityLabel={genre.name}>
                <DiscoverableGenreArtwork genre={genre} />
                <View style={styles.discoveryCopy}>
                  <Text style={styles.discoveryTitle}>{genre.name}</Text>
                  <Text style={styles.discoverySubtitle}>{t('home_discover_stations', 'Discover all the stations')}</Text>
                </View>
              </TouchableOpacity>)}
            </ScrollView>
            <View pointerEvents="none" style={{flexDirection:'row',gap:5,alignSelf:'center',marginTop:10,marginRight:sidePadding}}>
              {discoverableGenresList.map((genre, index) => <View key={genre.slug} style={{width:index === activeDiscoveryBanner ? 16 : 5,height:3,borderRadius:2,backgroundColor:index === activeDiscoveryBanner ? '#FF4199' : '#49494D'}} />)}
            </View>
          </View>}
          <View style={styles.section}>
            {sectionHeading(t('homepage_favorites_from_users'), () => router.push('/users'))}
            {(publicProfilesLoading||profileDiscoveryLoading)?<MegaLoadingState variant="user-cards" count={responsive.isTablet?8:6} inset={0} style={{paddingTop:0}}/>:<View style={[styles.usersList, responsive.isTablet && styles.tabletUsers]}>
              {discoveryProfiles.map(profileUser => (
                <TouchableOpacity key={profileUser._id} style={[styles.userItem, responsive.isTablet && { width: '48%' }]}
                  onPressIn={() => void preloadUserFavorites(profileUser._id, queryClient)}
                  onPress={() => router.push({ pathname: '/user-profile', params: { userId: profileUser._id,
                    userName: profileUser.name || profileUser.fullName || 'User', userSlug: profileUser.slug || '', userAvatar: profileUser.profileImageUrl || profileUser.profilePhoto || profileUser.avatar || '' } })}
                  testID={`user-profile-${profileUser._id}`} accessibilityRole="button">
                  <AvatarWithFallback uri={profileUser.profileImageUrl || profileUser.profilePhoto || profileUser.avatar} size={30} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userNameText} numberOfLines={1}>{profileUser.name || profileUser.fullName || 'User'}</Text>
                    <Text style={styles.userRadioCount}>{profileUser.favorites_count ?? profileUser.favoriteStationsCount ?? profileUser.favoriteCount ?? 0} {t('radios')}</Text>
                  </View>
                  <Svg width={24} height={24} viewBox="0 0 24 24">
                    <Path d="M14.4299 5.92999L20.4999 12L14.4299 18.07M11.01 12H20.33M3.5 12H6.97" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </Svg>
                </TouchableOpacity>
              ))}
            </View>}
          </View>
          <View style={[styles.section, { marginBottom: 32 }]}>
            {sectionHeading(t('homepage_all_stations'))}
            {(!isLoaded || allStationsLoading) && !allStations.length ? <MegaLoadingState variant="grid" columns={gridMetrics.columns} gap={homeGridGap} count={9} inset={0} availableWidth={responsive.width-sidePadding*2}/> : <>
              {renderResponsiveGrid(allStations, responsive.isTablet ? 25 : 21, false, rejectCatalogLogo)}
              {seeMore(() => router.push({ pathname: '/all-stations', params: { country: country || undefined, countryCode: countryCode || undefined } }), 'home-all-stations-see-more')}
            </>}
          </View>
          <LinearGradient colors={['#9672EC', '#C74AE7']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.registrationInvite} testID="home-registration-invite">
            <Text style={styles.registrationTitle}>{t('home_registration_title', { appName: 'MegaRadio' })}</Text>
            <Text style={styles.registrationDescription}>{t('home_registration_description', { appName: 'MegaRadio' })}</Text>
            <TouchableOpacity style={styles.registrationButton} accessibilityRole="button" testID="home-registration-signup" onPress={() => router.push('/signup')}>
              <Text style={styles.registrationButtonText}>{t('home_registration_signup')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.ScrollView>
      </SafeAreaView>
      {locationNotice&&<ProfilePhotoFeedback notice={locationNotice} onDismiss={dismissLocationNotice} durationMs={3500}/>}
      <PremiumPaywall visible={showPaywall} onClose={() => setShowPaywall(false)} mode="premium" />
    </View>
  );
}

const styles = StyleSheet.create({
  registrationInvite: { marginTop: 24, borderRadius: 12, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28, alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 600 },
  registrationTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 20, lineHeight: 26, color: '#FFFFFF', textAlign: 'center', marginBottom: 14 },
  registrationDescription: { fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 21, color: '#FFFFFF', textAlign: 'center', maxWidth: 340, marginBottom: 22 },
  registrationButton: { minWidth: 160, minHeight: 44, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  registrationButtonText: { fontFamily: 'Ubuntu-Bold', fontSize: 14, lineHeight: 20, color: '#C74AE7', textAlign: 'center' },
  container: { flex: 1, backgroundColor: '#1B1C1E' },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  topGlow: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  homeGlowImage: { position: 'absolute', left: -369, width: 844, height: 844 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingBottom: 20, gap: 8 },
  headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIdentity: { flex: 1, minWidth: 0 },
  welcomeText: { fontFamily: typography.fonts.regular, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  userName: { fontFamily: typography.fonts.bold, fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  headerRight: { marginRight: -4, flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIconImage: { width: 24, height: 24 },
  flagImageHeader: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden' },
  notificationDot: { position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: '#EB5757' },
  premiumBanner: { height: 54, borderRadius: 5, overflow: 'hidden', marginBottom: 20 },
  premiumGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  premiumIcon: { width: 30, height: 30, borderRadius: 5.769, overflow: 'hidden' },
  premiumCopy: { flex: 1, gap: 4, marginTop: 2 },
  premiumTitle: { fontFamily: typography.fonts.bold, fontSize: 14, lineHeight: 16, color: '#FFFFFF' },
  premiumSubtitle: { fontFamily: typography.fonts.medium, fontSize: 12, lineHeight: 14, color: '#FFFFFF' },
  section: { width: '100%', marginBottom: 32 },
  genreSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  sectionTitle: { flexShrink: 1, fontFamily: typography.fonts.bold, fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  seeAllText: { fontFamily: typography.fonts.medium, fontSize: 14, color: '#FF4199' },
  genresScroll: { gap: 10 },
  genreCard: { borderRadius: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  genreLabel: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  genreCardText: { fontFamily: typography.fonts.bold, fontSize: 18, lineHeight: 21, color: '#FFFFFF', overflow: 'visible', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 10 },
  popularList: { gap: 15 },
  popularItem: { minHeight: 80, flexDirection: 'row', alignItems: 'center', backgroundColor: '#272727', borderRadius: 10, padding: 15, gap: 15 },
  popularLogo: { width: 50, height: 50, borderRadius: 5, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  popularInfo: { flex: 1, minWidth: 0 },
  popularName: { fontFamily: typography.fonts.medium, fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  stationCity: { fontFamily: typography.fonts.regular, color: '#AEAEB2' },
  locationLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 6 },
  locationLinkText: { color: '#FF4199', fontFamily: typography.fonts.medium, fontSize: 14 },
  nearbyEmptyText: { fontFamily: typography.fonts.regular, fontSize: 14, color: '#AEAEB2', textAlign: 'center', paddingVertical: 12 },
  popularCountry: { fontFamily: typography.fonts.bold, fontSize: 12, lineHeight: 18, color: '#FFFFFF' },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#353535', justifyContent: 'center', alignItems: 'center' },
  playIcon: { width: 26, height: 26 },
  stationGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 24 },
  gridItem: { minWidth: 0 },
  gridImage: { borderRadius: 10, backgroundColor: '#FFFFFF', marginBottom: 10, overflow: 'hidden' },
  stationGridName: { fontFamily: typography.fonts.medium, fontSize: 12, lineHeight: 17, color: '#FFFFFF' },
  stationGridCountry: { fontFamily: typography.fonts.medium, fontSize: 10, lineHeight: 15, color: '#FFFFFF' },
  stationGridDistance: { fontFamily: typography.fonts.regular, fontSize: 10, lineHeight: 15, color: '#AAAAAA' },
  stationGridCity: { fontFamily: 'Ubuntu-Light', color: '#AAAAAA' },
  seeMoreButton: { alignSelf: 'center', backgroundColor: '#454545', paddingHorizontal: 22, height: 44, justifyContent: 'center', borderRadius: 22, marginTop: 28 },
  seeMoreText: { fontFamily: typography.fonts.bold, fontSize: 14, color: '#FFFFFF' },
  discoveryBanner: { backgroundColor: '#00B3EB', borderRadius: 5, overflow: 'hidden', justifyContent: 'center' },
  discoveryCopy: { marginLeft: '47%', paddingRight: 12 },
  discoveryTitle: { fontFamily: typography.fonts.bold, fontSize: 28, lineHeight: 34, color: '#FFFFFF' },
  discoverySubtitle: { fontFamily: typography.fonts.regular, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  usersList: { gap: 10 },
  tabletUsers: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  userItem: { minHeight: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: '#272727', padding: 15, borderRadius: 10, gap: 12 },
  userInfo: { flex: 1, minWidth: 0 },
  userNameText: { fontFamily: typography.fonts.medium, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  userRadioCount: { fontFamily: typography.fonts.regular, fontSize: 12, lineHeight: 16, color: '#AEAEB2' },
  emptyText: { fontFamily: typography.fonts.regular, fontSize: 13, lineHeight: 20, color: '#AEAEB2', textAlign: 'center', paddingVertical: 20 },
});

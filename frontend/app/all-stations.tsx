import {CountryFlag} from '../src/components/CountryFlag';
import { useMegaSearchFocus } from '../src/hooks/useMegaSearchFocus';
import {MegaRefreshControl as RefreshControl} from '../src/components/MegaRefreshControl';
import {MegaLoadingState} from '../src/components/MegaLoadingState';
import { STATION_SEARCH_VERSION } from '../src/utils/stationSearch';
import { useCatalogPageScroll } from '../src/hooks/useCatalogPageScroll';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import { CatalogPagination } from '../src/components/CatalogPagination';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,

  TextInput,
  useWindowDimensions,
  Platform,
  Keyboard} from 'react-native';
import { isGlobalCountry } from '../src/utils/countryScope';
import { SearchNoResults } from '../src/components/SearchNoResults';
import { CountryDiscoveryIcon } from '../src/components/BrandIcons';
import { CountrySelectorModal } from '../src/components/CountrySelectorModal';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { colors } from '../src/constants/theme';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { stationService } from '../src/services/stationService';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { usePlayerStore } from '../src/store/playerStore';
import { useLocationStore } from '../src/store/locationStore';
import { useResponsive } from '../src/hooks/useResponsive';
import { SortBottomSheet, SortOption, ViewMode } from '../src/components/SortBottomSheet';
import { getStationLogoUrl } from '../src/utils/stationLogoHelper';
import type { Station } from '../src/types';

const STATIONS_PER_PAGE = 60;
const VIEW_MODE_STORAGE_KEY = '@megaradio_all_stations_view_mode';

export default function AllStationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const genreSlug = (params.genre || params.slug) as string | undefined;
  const genreName = (params.genreName || params.name || genreSlug) as string | undefined;
  // Get country from params (passed from See More) or fall back to location store
  const paramCountry = params.country as string | undefined;
  const paramCountryCode = params.countryCode as string | undefined;
  const { width: windowWidth } = useWindowDimensions();

  // Responsive layout
  const responsive = useResponsive();
  const gridMetrics = responsive.getGridMetrics();
  const GRID_COLUMNS = gridMetrics.columns;
  const GRID_ITEM_WIDTH = Math.floor((windowWidth - 30 - (GRID_COLUMNS - 1) * 22.5) / GRID_COLUMNS);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const searchFocus = useMegaSearchFocus();
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'allStations', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const [sortOption, setSortOption] = useState<SortOption>('popular');
  const [showSortSheet, setShowSortSheet] = useState(__DEV__ && Platform.OS === 'web' && params.sort === '1');
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);
  const pageScroll = useCatalogPageScroll(y => scrollRef.current?.scrollTo({ y, animated: false }));
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(searchQuery.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [searchQuery]);

  // Use param country if available, otherwise use location store
  const { countryCode: storeCountryCode, country: storeCountry, countryEnglish, isLoaded } = useLocationStore();
  const countryCode = paramCountry ? paramCountryCode : storeCountryCode;
  const country = paramCountry || storeCountry;

  // Load saved view mode preference on mount
  useEffect(() => {
    const loadViewMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY);
        if (savedMode === 'grid' || savedMode === 'list') {
          setViewMode(savedMode);
        }
      } catch (error) {
        console.log('Error loading view mode:', error);
      }
    };
    loadViewMode();
  }, []);

  // Save view mode preference when changed
  const handleViewModeChange = useCallback(async (mode: ViewMode) => {
    setViewMode(mode);
    try {
      await AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch (error) {
      console.log('Error saving view mode:', error);
    }
  }, []);

  // Sort the complete scoped catalog on the server before pagination.
  // Use countryEnglish for API as backend expects English country names
  // Wait for country to load before making API call
  const selectedCountry = paramCountry || countryEnglish || country;
  const apiCountry = isLoaded && !isGlobalCountry(selectedCountry) ? selectedCountry || undefined : undefined;

  const { data, isLoading, isFetching, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ['all-stations', 'catalog-sort-v2', STATION_SEARCH_VERSION, debouncedSearch ? 'relevance' : sortOption, STATIONS_PER_PAGE, apiCountry, genreSlug, debouncedSearch ? 1 : page, debouncedSearch],
    queryFn: async ({ signal }) => {
      const filterKey = JSON.stringify([apiCountry, genreSlug, debouncedSearch, debouncedSearch ? 'relevance' : sortOption]);
      if (debouncedSearch) {
        // A bounded search pool, fetched once per query/scope, never the full catalog.
        const stations = await stationService.searchStations(debouncedSearch, 500, signal, { country: apiCountry, genre: genreSlug });
        return { stations, totalCount: stations.length, filterKey, searchCapped: stations.length === 500 };
      }
      return { ...await stationService.getStations({ limit: STATIONS_PER_PAGE, page, genre: genreSlug || undefined, country: apiCountry, sort: sortOption === 'popular' ? 'votes' : sortOption }, signal), filterKey, searchCapped: false };
    },
    enabled: isLoaded,
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  const { playStation } = useAudioPlayer();
  const { currentStation, playbackState, isMiniPlayerVisible } = usePlayerStore();

  const waitingForSearch = searchQuery.trim() !== debouncedSearch || (isPlaceholderData && data?.filterKey !== JSON.stringify([apiCountry, genreSlug, debouncedSearch, debouncedSearch ? 'relevance' : sortOption]));
  const stations = useMemo(() => {
    const rows = data?.stations || [];
    return debouncedSearch ? rows.slice((page - 1) * STATIONS_PER_PAGE, page * STATIONS_PER_PAGE) : rows;
  }, [data?.stations, debouncedSearch, page]);
  const showSearchEmpty = !!genreSlug && !!debouncedSearch && searchQuery.trim() === debouncedSearch && !isFetching && !waitingForSearch && !isError && stations.length === 0;
  const totalCount = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / STATIONS_PER_PAGE));
  useEffect(() => { setPage(1); }, [apiCountry, genreSlug]);
  useEffect(() => { if (!isPlaceholderData && page > pageCount) setPage(pageCount); }, [page, pageCount, isPlaceholderData]);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'miniPlayer', visible }, 'http://localhost:8082');
      notify(isMiniPlayerVisible && !!currentStation); return () => notify(false);
    }
  }, [isMiniPlayerVisible, currentStation]));
  const changePage = (nextPage: number) => {
    if (isFetching || nextPage === page || nextPage < 1 || nextPage > pageCount) return;
    setPage(nextPage); pageScroll.top();
  };


  // Search already has relevance order; catalog pages retain the server's global order.
  const filteredStations = stations;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleBackPress = () => {
    if (router.canGoBack()) router.back(); else router.replace(genreSlug ? '/(tabs)/genres' : '/(tabs)');
  };

  const handleStationPress = (station: Station) => {
    playStation(station, { kind: 'browse', country: apiCountry });
  };

  const isStationPlaying = (station: Station) => {
    return currentStation?._id === station._id && playbackState === 'playing';
  };

  const isStationLoading = (station: Station) => {
    return currentStation?._id === station._id &&
      (playbackState === 'loading' || playbackState === 'buffering');
  };

  // Show genre name or "All Stations in [Country]"
  const title = genreName || t('all_stations', 'All Stations');

  // Helper function to build reliable logo URL with fallback - using centralized helper
  const getLogoUrl = useCallback((station: Station): string | null => {
    return getStationLogoUrl(station);
  }, []);

  // Grid Item Render Function - no hooks, using Image's built-in error handling
  const renderGridItem = useCallback((station: Station) => {
    const logoUrl = getLogoUrl(station);
    const playing = isStationPlaying(station);

    return (
      <TouchableOpacity
        key={station._id}
        style={[styles.gridItem, { width: GRID_ITEM_WIDTH }, playing && styles.gridItemActive]}
        onPress={() => handleStationPress(station)}
        activeOpacity={0.7}
        testID={`grid-station-${station._id}`}
      >
        <View style={[styles.gridLogoContainer, { width: GRID_ITEM_WIDTH, height: GRID_ITEM_WIDTH }]}>
          <ImageWithFallback
            testID={`all-stations-grid-logo-${station._id}`}
            uri={logoUrl}
            style={styles.gridLogo}
            contentFit="cover"
          />
        </View>
        <Text style={[styles.gridName, { width: GRID_ITEM_WIDTH }]} numberOfLines={1}>{station.name}</Text>
        <Text style={[styles.gridLocation, { width: GRID_ITEM_WIDTH }]} numberOfLines={1}>
          <Text style={styles.locationCountry}>{station.country}</Text>{station.state ? `, ${station.state}` : ''}
        </Text>
      </TouchableOpacity>
    );
  }, [GRID_ITEM_WIDTH, isStationPlaying, handleStationPress, getLogoUrl]);

  // List Item Render Function - no hooks, using Image's built-in error handling
  const renderListItem = useCallback((station: Station) => {
    const logoUrl = getLogoUrl(station);
    const playing = isStationPlaying(station);
    const loading = isStationLoading(station);

    return (
      <TouchableOpacity
        key={station._id}
        style={[styles.listItem, playing && styles.listItemActive]}
        onPress={() => handleStationPress(station)}
        activeOpacity={0.7}
        testID={`list-station-${station._id}`}
      >
        <View style={styles.listLogoContainer}>
          <ImageWithFallback
            testID={`all-stations-list-logo-${station._id}`}
            uri={logoUrl}
            style={styles.listLogo}
            contentFit="cover"
          />
        </View>
        <View style={styles.listInfo}>
          <Text style={styles.listName} numberOfLines={1}>{station.name}</Text>
          <Text style={styles.listLocation} numberOfLines={1}>
            <Text style={styles.locationCountry}>{station.country}</Text>{station.state ? `, ${station.state}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.playButton, playing && styles.playButtonActive]}
          accessibilityRole="button" accessibilityLabel={`${playing ? t('pause', 'Pause') : t('play', 'Play')} ${station.name}`}
          onPress={() => handleStationPress(station)}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            playing ? <Ionicons name="pause" size={26} color="#FFFFFF" /> : <Image source={require('../assets/images/all-stations/play.svg')} style={{ width: 26, height: 26 }} contentFit="contain" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [isStationPlaying, isStationLoading, handleStationPress, getLogoUrl]);

  return (
    <View style={styles.mainContainer}>
      <View style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              testID="all-stations-back-btn" accessibilityRole="button" accessibilityLabel={t('back', 'Back')}
            >
              <Image source={require('../assets/images/all-stations/back.svg')} style={styles.headerIcon} tintColor="#FFFFFF" contentFit="contain" />
            </TouchableOpacity>

            {isLoaded && (isGlobalCountry(country) || !!countryCode && /^[a-z]{2}$/i.test(countryCode)) && (
              <TouchableOpacity style={styles.countryTouch} accessibilityLabel={paramCountry || country || countryCode || t('nav_global', 'Global')} accessibilityRole="button" accessibilityState={{ expanded: showCountrySelector }} testID="all-stations-country-flag" onPress={() => setShowCountrySelector(true)}>
                <View style={styles.countryBadge}>
                {isGlobalCountry(country) ? <CountryDiscoveryIcon size={28} /> : <CountryFlag code={countryCode} size={28} />}
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle}>{waitingForSearch || isLoading ? '…' : `${totalCount}${data?.searchCapped ? '+' : ''}`}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => { Keyboard.dismiss(); setShowSortSheet(true); }}
                testID="sort-btn" accessibilityRole="button" accessibilityLabel={t('sort', 'Sort')}
              >
                <Image source={require('../assets/images/all-stations/filter.svg')} style={styles.headerIcon} tintColor="#FFFFFF" contentFit="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowSearch(value => !value)}
                testID="search-btn" accessibilityRole="button" accessibilityLabel={t('search', 'Search')}
              >
                <Image source={require('../assets/images/all-stations/search.svg')} style={styles.headerIcon} tintColor="#FFFFFF" contentFit="contain" />
              </TouchableOpacity>
            </View>
          </View>

          <CountrySelectorModal visible={showCountrySelector} onClose={() => setShowCountrySelector(false)} onSelect={selected => {
            setPage(1);
            setSearchQuery('');
            setDebouncedSearch('');
            scrollRef.current?.scrollTo({ y: 0, animated: false });
            router.setParams({ country: selected.name, countryCode: selected.code });
          }} />

          {/* Search bar can be toggled from the header. */}
          {showSearch && <View style={styles.searchContainer}>
            <View style={[styles.searchBar,searchFocus.fieldStyle]} testID="stations-search-field">
              <Image source={require('../assets/images/home/search.svg')} style={styles.searchIcon} tintColor="#616161" contentFit="contain" />
              <TextInput
                style={[styles.searchInput,searchFocus.inputStyle]}
                onFocus={searchFocus.onFocus}
                onBlur={searchFocus.onBlur}
                selectionColor={searchFocus.selectionColor}
                placeholder={t('search_stations', 'Search stations...')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="stations-search-input"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity testID="stations-search-clear" style={styles.clearSearchButton} accessibilityRole="button" accessibilityLabel={t('clear_search', 'Clear search')} onPress={() => setSearchQuery('')}>
                  <Image source={require('../assets/images/favorites/clear.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
                </TouchableOpacity>
              )}
            </View>
          </View>}

          {waitingForSearch || (isLoading && stations.length === 0) ? (
            <MegaLoadingState page variant={viewMode==='grid'?'grid':'station-list'} columns={GRID_COLUMNS} gap={22.5} count={9} style={{paddingTop:0}}/>
          ) : (
            <ScrollView
              ref={scrollRef}
              {...pageScroll.scrollProps}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, showSearchEmpty && { flexGrow: 1 }, { paddingHorizontal: 15, paddingBottom: 16 + (isMiniPlayerVisible && currentStation ? 86 : 0) }]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {viewMode === 'grid' ? (
                <View style={styles.gridContainer}>
                  {/* Render items in rows based on responsive columns */}
                  {Array.from({ length: Math.ceil(filteredStations.length / GRID_COLUMNS) }).map((_, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={[styles.gridRow, { gap: 22.5 }]}>
                      {filteredStations.slice(rowIndex * GRID_COLUMNS, (rowIndex + 1) * GRID_COLUMNS).map(renderGridItem)}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.listContainer, responsive.isTablet && { flexDirection: 'row', flexWrap: 'wrap' }]}>
                  {filteredStations.map((station) => (
                    <View key={station._id} style={responsive.isTablet ? { width: '50%', paddingHorizontal: 4 } : undefined}>
                      {renderListItem(station)}
                    </View>
                  ))}
                </View>
              )}

              {showSearchEmpty ? <SearchNoResults message="No stations found" /> : filteredStations.length === 0 && !isLoading && !isFetching && (
                <View style={styles.emptyState}>
                  <Ionicons name="radio-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyText}>
                    {searchQuery ? 'No stations found' : 'No stations available'}
                  </Text>
                </View>
              )}

              {pageCount > 1 && <CatalogPagination page={page} pageCount={pageCount} busy={isFetching}
                onChange={changePage} testID="all-stations-pagination"
                summary={`${Math.min((page - 1) * STATIONS_PER_PAGE + 1, totalCount)}–${Math.min(page * STATIONS_PER_PAGE, totalCount)} / ${totalCount}${data?.searchCapped ? '+' : ''}`} />}

            </ScrollView>
          )}

          <SortBottomSheet
            visible={showSortSheet}
            onClose={() => setShowSortSheet(false)}
            sortOption={sortOption}
            onSortChange={option => { setSortOption(option); setPage(1); }}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#1B1C1E' },
  gradient: { flex: 1, backgroundColor: '#1B1C1E' },
  container: { flex: 1 },
  header: { height: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, backgroundColor: '#1B1C1E' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  countryTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  countryBadge: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  countryFlag: { width: 28, height: 28, borderRadius: 14 },
  titleContainer: { position: 'absolute', left: 95, right: 95, top: 22, alignItems: 'center' },
  title: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21, color: '#FFFFFF', maxWidth: '100%' },
  subtitle: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 14, color: '#A6A6A6', marginTop: 2 },
  headerActions: { flexDirection: 'row', marginLeft: 'auto' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 24, height: 24 },
  searchContainer: { paddingHorizontal: 15, paddingBottom: 20 },
  searchBar: { height: 48, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F7F8FA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchIcon: {width:24,height:24},
  searchInput: { flex: 1, minWidth: 0, height: 44, fontFamily: 'Ubuntu-Regular', fontSize: 16, color: '#1B1C1E', paddingVertical: 0, borderWidth: 0, outlineWidth: 0, outlineStyle: 'solid' },
  clearSearchButton: { width: 44, height: 44, marginRight: -12, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 }, scrollContent: {},
  gridContainer: {},
  gridRow: { flexDirection: 'row', marginBottom: 24 },
  gridItem: { alignItems: 'flex-start' },
  gridItemActive: { opacity: 0.8 },
  gridLogoContainer: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#282828', marginBottom: 10 },
  gridLogo: { width: '100%', height: '100%' },
  gridName: { fontSize: 13, lineHeight: 16, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', marginBottom: 4 },
  gridLocation: { fontSize: 10, lineHeight: 14, fontFamily: 'Ubuntu-Regular', color: '#AAAAAA' },
  locationCountry: { fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
  listContainer: {},
  listItem: { height: 80, padding: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: '#282828', borderRadius: 10, marginBottom: 15 },
  listItemActive: { backgroundColor: '#343434' },
  listLogoContainer: { width: 50, height: 50, borderRadius: 5, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  listLogo: { width: '100%', height: '100%' },
  listInfo: { flex: 1, marginLeft: 15, marginRight: 12 },
  listName: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, color: '#FFFFFF', marginBottom: 5 },
  listLocation: { fontFamily: 'Ubuntu-Regular', fontSize: 10, lineHeight: 12, color: '#AAAAAA' },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#343434', justifyContent: 'center', alignItems: 'center' },
  playButtonActive: { backgroundColor: '#454545' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: 'Ubuntu-Medium', fontSize: 14, color: '#A6A6A6', marginTop: 16 },

});

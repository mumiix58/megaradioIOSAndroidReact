import { useMegaSearchFocus } from '../../src/hooks/useMegaSearchFocus';
import {MegaLoadingState} from '../../src/components/MegaLoadingState';
import { rankStationSearch } from '../../src/utils/stationSearch';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView, Keyboard, Platform} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FavoriteCategories } from '../../src/components/FavoriteCategories';
import { ImageWithFallback } from '../../src/components/ImageWithFallback';
import { SortBottomSheet } from '../../src/components/SortBottomSheet';
import { FavoriteOrderPanel } from '../../src/components/FavoriteOrderPanel';
import { useFavoritesStore, SortOption } from '../../src/store/favoritesStore';
import { useAudioPlayer } from '../../src/hooks/useAudioPlayer';
import { usePlayerStore } from '../../src/store/playerStore';
import { useAuthStore } from '../../src/store/authStore';
import { useResponsive } from '../../src/hooks/useResponsive';
import { getStationLogoUrl } from '../../src/utils/stationLogoHelper';
import type { Station } from '../../src/types';

export default function FavoritesScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { t } = useTranslation(); const responsive = useResponsive();
  const params = useLocalSearchParams<{ previewFavorites?: string; previewSearch?: string; previewSort?: string }>();
  const preview = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1';
  const previewEmpty = preview && params.previewFavorites === 'empty';
  const previewDemo = preview && params.previewFavorites === 'demo';
  const { favorites, isLoaded, isLoading, error, loadFavorites, removeFavorite, sortOption, viewMode, setSortOption, setViewMode, getSortedFavorites, updateCustomOrder } = useFavoritesStore();
  const { isAuthLoaded, isAuthenticated, user } = useAuthStore();
  const owner = user?._id || user?.id;
  const { playStation: playRadio } = useAudioPlayer();
  const playStation = (station: Station) => playRadio(station, { kind: 'favorites' });
  const currentStation = usePlayerStore(state => state.currentStation);
  const searchFocus = useMegaSearchFocus();
  const [isSearchActive, setIsSearchActive] = useState(preview && params.previewSearch === '1');
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'sort' | 'custom' | null>(preview && params.previewSort === '1' ? 'sort' : null);
  const [draft, setDraft] = useState<Station[]>([]);
  const [previewRemoved, setPreviewRemoved] = useState<string[]>([]);
  const previewOrder = useRef<string[] | null>(null);
  useEffect(() => { if (isAuthLoaded) void loadFavorites(); }, [isAuthLoaded, isAuthenticated, owner]);
  useEffect(() => { setQuery(''); setSheet(preview && params.previewSort === '1' ? 'sort' : null); setPreviewRemoved([]); previewOrder.current = null; }, [owner]);
  const sorted = previewEmpty ? [] : getSortedFavorites().filter(item => !previewDemo || !previewRemoved.includes(item._id));
  if (previewDemo && sortOption === 'custom' && previewOrder.current) sorted.sort((a, b) => previewOrder.current!.indexOf(a._id) - previewOrder.current!.indexOf(b._id));
  const darkHeader = !isSearchActive && sorted.length > 0;
  useFocusEffect(useCallback(() => {
    if (preview) window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'favoritesHeader', visible: darkHeader }, 'http://localhost:8082');
    return () => { if (preview) window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'favoritesHeader', visible: false }, 'http://localhost:8082'); };
  }, [preview, darkHeader]));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const genre = (station: Station) => station.genres?.[0] || 'Radio';
  const filtered = normalizedQuery ? rankStationSearch(sorted, query, sorted.length) : sorted;
  const closeSearch = () => { setIsSearchActive(false); setQuery(''); Keyboard.dismiss(); };
  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'newest', label: t('sort_newest_first', 'Newest first') }, { key: 'oldest', label: t('sort_oldest_first', 'Oldest first') },
    { key: 'az', label: t('sort_az', 'A-Z') }, { key: 'za', label: t('sort_za', 'Z-A') }, { key: 'custom', label: t('custom_order', 'Custom order') },
  ];
  const chooseSort = (option: SortOption) => {
    if (option === 'custom') { setDraft([...sorted]); setSheet('custom'); return false; }
    setSortOption(option);
  };
  const saveOrder = async (items: Station[]) => {
    const current = useAuthStore.getState().user;
    if ((current?._id || current?.id) !== owner) { setSheet(null); return; }
    if (previewDemo) previewOrder.current = items.map(item => item._id);
    else {
      // Reconcile a removal/addition made elsewhere while this sheet was open.
      const live = useFavoritesStore.getState().favorites;
      const liveIds = new Set(live.map(item => item._id));
      const order = items.map(item => item._id).filter(id => liveIds.has(id));
      await updateCustomOrder([...order, ...live.map(item => item._id).filter(id => !order.includes(id))]);
    }
    setSortOption('custom'); setSheet(null);
  };
  const columns = responsive.isTablet ? 5 : 3;
  const gridWidth = (Math.min(responsive.width, 930) - 30 - (columns - 1) * 15) / columns;
  const renderHeart = (item: Station, grid = false) => <TouchableOpacity testID={`remove-favorite-${item._id}`} accessibilityRole="button" accessibilityLabel={t('remove_favorite_named', 'Remove {{name}} from favorites', { name: item.name })} style={[s.heartTouch, grid && s.gridHeart]} onPress={event => { event.stopPropagation(); if (previewDemo) setPreviewRemoved(previous => [...previous, item._id]); else void removeFavorite(item._id); }}><View style={[s.heartCircle, grid && { backgroundColor: 'transparent' }]}><Image source={require('../../assets/images/mini-player/heart-filled.svg')} style={[s.icon, grid && s.gridHeartGlow]} tintColor="#FF4199" /></View></TouchableOpacity>;
  const renderStation = ({ item }: { item: Station }) => viewMode === 'grid' ? <TouchableOpacity testID={`favorite-grid-${item._id}`} accessibilityRole="button" accessibilityLabel={item.name} onPress={() => playStation(item)} style={[s.gridItem, { width: gridWidth }]}>
    <View style={s.gridArtwork}><ImageWithFallback uri={getStationLogoUrl(item)} style={s.gridLogo} />{renderHeart(item, true)}</View><Text numberOfLines={1} style={s.gridName}>{item.name}</Text><Text numberOfLines={1} style={s.gridGenre}>{genre(item)}</Text>
  </TouchableOpacity> : <TouchableOpacity testID={`favorite-station-${item._id}`} accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: currentStation?._id === item._id }} style={s.card} activeOpacity={0.75} onPress={() => playStation(item)}>
    <ImageWithFallback testID={`favorite-list-logo-${item._id}`} uri={getStationLogoUrl(item)} style={s.logo} />
    <View style={s.info}><Text style={s.name} numberOfLines={1}>{item.name}</Text><Text style={s.genre} numberOfLines={1}>{genre(item)}</Text></View>
    {renderHeart(item)}
  </TouchableOpacity>;
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: darkHeader ? '#131313' : '#1B1C1E' }} />
    {isSearchActive ? <View style={s.searchHeader}>
      <View testID="favorites-search-field" style={[s.searchBox,searchFocus.fieldStyle]}><Image source={require('../../assets/images/home/search.svg')} style={s.icon} tintColor="#616161" /><TextInput testID="favorites-search-input" style={[s.input,searchFocus.inputStyle]} onFocus={searchFocus.onFocus} onBlur={searchFocus.onBlur} selectionColor={searchFocus.selectionColor} value={query} onChangeText={setQuery} placeholder={t('search_favorites', 'Search favorites')} placeholderTextColor="#616161" accessibilityLabel={t('search_favorites', 'Search favorites')} autoFocus returnKeyType="search" />
        {query.length > 0 && <TouchableOpacity testID="search-clear-btn" style={s.clearTouch} accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')} onPress={() => setQuery('')}><Image source={require('../../assets/images/favorites/clear.svg')} style={s.icon} /></TouchableOpacity>}
      </View><TouchableOpacity testID="search-cancel-btn" style={s.cancelTouch} accessibilityRole="button" onPress={closeSearch}><Text style={s.cancelText}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>
    </View> : <View style={[s.header, darkHeader && { backgroundColor: '#131313' }]}>
      <View style={[s.heading, sorted.length === 0 && s.headingEmpty]}><Text style={s.title}>{t('favorites', 'Favorites')}</Text>{sorted.length > 0 && <Text testID="favorites-header-count" style={s.count}>{sorted.length}</Text>}</View>
      <View style={s.headerActions}><TouchableOpacity testID="sort-btn" style={s.iconTouch} onPress={() => { Keyboard.dismiss(); setSheet('sort'); }} accessibilityRole="button" accessibilityLabel={t('sort', 'Sort')}><Image source={require('../../assets/images/genres/sort.svg')} style={s.icon} /></TouchableOpacity><TouchableOpacity testID="search-btn" style={s.iconTouch} onPress={() => setIsSearchActive(true)} accessibilityRole="button" accessibilityLabel={t('search', 'Search')}><Image source={require('../../assets/images/home/search.svg')} style={s.icon} /></TouchableOpacity></View>
    </View>}
    {!previewEmpty && (!isAuthLoaded || !isLoaded || (isLoading && favorites.length === 0)) ? <MegaLoadingState page variant={viewMode==='grid'?'grid':'station-list'} columns={columns} count={viewMode==='grid'?9:6} style={{paddingTop:20}}/> : !isSearchActive && sorted.length === 0 ? error && !previewEmpty ? <View style={s.center}><Text style={s.noResults}>{t('favorites_load_error', 'Could not load favorites.')}</Text><TouchableOpacity style={s.retryTouch} onPress={() => void loadFavorites()} accessibilityRole="button"><Text style={s.discoverText}>{t('retry', 'Retry')}</Text></TouchableOpacity></View> : <ScrollView testID="favorites-empty-state" showsVerticalScrollIndicator={false} contentContainerStyle={s.emptyScroll}><View style={s.empty}><View style={s.emptyContent}>
      <Image source={require('../../assets/images/favorites/empty-heart.svg')} style={s.emptyHeart} /><Text style={s.emptyTitle}>{t('no_favorites_yet', "You don't have any favorites yet")}</Text><TouchableOpacity testID="discover-stations-btn" style={s.discoverTouch} accessibilityRole="button" onPress={() => router.navigate('/(tabs)')}><Text style={s.discoverText}>{t('discover_stations_link', 'Discover stations near to you!')}</Text><Image source={require('../../assets/images/favorites/discover-arrow.svg')} style={s.discoverArrow} /></TouchableOpacity>
    </View></View><FavoriteCategories /></ScrollView> : <FlatList key={`${viewMode}-${columns}`} testID="favorites-list" data={filtered} renderItem={renderStation} keyExtractor={item => item._id} numColumns={viewMode === 'grid' ? columns : 1} columnWrapperStyle={viewMode === 'grid' ? s.gridRow : undefined} contentContainerStyle={[s.list, viewMode === 'grid' && s.gridList]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} ListFooterComponent={!isSearchActive ? <View style={s.categoryFooter}><FavoriteCategories /></View> : null} ListEmptyComponent={<Text style={s.noResults}>{t('no_stations_found_search', 'No stations found')}</Text>} />}
    <SortBottomSheet<SortOption> visible={sheet !== null} onClose={() => setSheet(null)} sortOption={sortOption} onSortChange={chooseSort} options={sortOptions} variant="favorites" viewMode={viewMode} onViewModeChange={setViewMode} content={sheet === 'custom' ? <FavoriteOrderPanel key={owner || 'guest'} items={draft} onCancel={() => setSheet(null)} onSave={saveOrder} /> : undefined} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' }, header: { height: 78 }, heading: { position: 'absolute', left: 85, right: 85, top: 18, alignItems: 'center' }, headingEmpty: { top: 29 }, title: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21, color: '#FFFFFF' }, count: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 14, color: '#A6A6A6', marginTop: 2 }, headerActions: { position: 'absolute', right: 5, top: 18, flexDirection: 'row' }, iconTouch: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, icon: { width: 24, height: 24 },
  list: { width: '100%', maxWidth: 630, alignSelf: 'center', paddingHorizontal: 15, paddingTop: 20, paddingBottom: 20 }, card: { height: 80, paddingLeft: 15, paddingRight: 13, borderRadius: 10, backgroundColor: '#262626', flexDirection: 'row', alignItems: 'center', marginBottom: 15 }, logo: { width: 50, height: 50, borderRadius: 5 }, info: { flex: 1, minWidth: 0, marginLeft: 15, marginRight: 10 }, name: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, color: '#FFFFFF', marginBottom: 6 }, genre: { fontFamily: 'Ubuntu-Regular', fontSize: 14, lineHeight: 16, color: '#BFBFBF' }, heartTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, heartCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  searchHeader: { height: 102, paddingTop: 37, paddingBottom: 20, paddingLeft: 15, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 45, borderRadius: 10, backgroundColor: '#F7F8FC', paddingLeft: 15, paddingRight: 6, gap: 15 }, input: { flex: 1, minWidth: 0, height: 43, borderWidth:0, padding: 0, fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, color: '#1B1C1E' }, clearTouch: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, cancelTouch: { minWidth: 50, height: 44, justifyContent: 'center' }, cancelText: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, color: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyScroll: { flexGrow: 1, paddingBottom: 24 }, categoryFooter: { marginHorizontal: -15 }, empty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 45, paddingBottom: 35, paddingHorizontal: 20 }, emptyContent: { alignItems: 'center' }, emptyHeart: { width: 84, height: 84 }, emptyTitle: { fontFamily: 'Ubuntu-Medium', fontSize: 20, lineHeight: 23, color: '#FFFFFF', textAlign: 'center', maxWidth: 200, minHeight: 46, marginTop: 15 }, discoverTouch: { marginTop: 62, minHeight: 44, alignItems: 'center' }, discoverText: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15, color: '#FF4199', textAlign: 'center' }, discoverArrow: { width: 16, height: 16, marginTop: 9 }, noResults: { fontFamily: 'Ubuntu-Regular', fontSize: 15, color: '#9C9C9C', textAlign: 'center', paddingVertical: 40 }, retryTouch: { padding: 15 },
  gridList: { maxWidth: 930 }, gridRow: { gap: 15 }, gridItem: { marginBottom: 20 }, gridArtwork: { position: 'relative' }, gridHeart: { position: 'absolute', right: -7, bottom: -7 }, gridHeartGlow: { shadowColor: '#FF4199', shadowOffset: { width: 0, height: 0 }, shadowOpacity: Platform.OS === 'web' ? 0 : 0.25, shadowRadius: 3, ...(Platform.OS === 'web' ? { filter: 'drop-shadow(0 0 3px rgba(255, 65, 153, 0.38))' } : {}) }, gridLogo: { width: '100%', aspectRatio: 1, borderRadius: 10 }, gridName: { fontFamily: 'Ubuntu-Medium', fontSize: 14, lineHeight: 17, color: '#FFFFFF', marginTop: 10 }, gridGenre: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 15, color: '#BFBFBF', marginTop: 4 },
});

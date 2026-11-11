import {CountrySelectorModal} from '../../src/components/CountrySelectorModal';
import {CountryFlag} from '../../src/components/CountryFlag';
import {CountryDiscoveryIcon} from '../../src/components/BrandIcons';
import {isGlobalCountry} from '../../src/utils/countryScope';
import { useMegaSearchFocus } from '../../src/hooks/useMegaSearchFocus';
import {MegaRefreshControl as RefreshControl} from '../../src/components/MegaRefreshControl';
import {MegaLoadingState} from '../../src/components/MegaLoadingState';
import { useCatalogPageScroll } from '../../src/hooks/useCatalogPageScroll';
import { CatalogPagination } from '../../src/components/CatalogPagination';
import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,  Platform, Keyboard, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { SearchNoResults } from '../../src/components/SearchNoResults';
import api from '../../src/services/api';
import { useLocationStore } from '../../src/store/locationStore';
import type { Genre, GenreResponse } from '../../src/types';

const GENRES_PER_PAGE = 60;

export default function GenresTabScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { countryCode, country, isLoaded } = useLocationStore();
  const [showCountrySelector,setShowCountrySelector]=useState(false);
  const [search, setSearch] = useState('');
  const searchFocus = useMegaSearchFocus();
  const listRef = useRef<FlatList<Genre>>(null);
  const pageScroll = useCatalogPageScroll(offset => listRef.current?.scrollToOffset({ offset, animated: false }));
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  const [isSearching, setIsSearching] = useState(false);
  const closeSearch = useCallback(() => { setSearch(''); setIsSearching(false); Keyboard.dismiss(); }, []);
  useFocusEffect(useCallback(() => {
    if (!isSearching) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { closeSearch(); return true; });
    return () => subscription.remove();
  }, [isSearching, closeSearch]));
  const [alphabetical, setAlphabetical] = useState(false);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'genres', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ['genres-catalog', countryCode || 'global'],
    queryFn: async () => {
      // Load every catalog page so filtering searches the entire selected country.
      const fetchPage = async (page: number) => (await api.get<GenreResponse>('/api/genres', { params: { country: countryCode || undefined, page, limit: 100 } })).data;
      const first = await fetchPage(1);
      const pages = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => fetchPage(i + 2)));
      const unique = new Map<string, Genre>();
      [first, ...pages].flatMap(p => p.data).forEach(g => unique.set(g.slug, g));
      return [...unique.values()];
    },
    staleTime: 5 * 60 * 1000,
  });
  const genres = useMemo(() => (data || []).filter(g => g.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => alphabetical ? a.name.localeCompare(b.name) : (b.stationCount ?? b.total_stations ?? 0) - (a.stationCount ?? a.total_stations ?? 0)), [data, search, alphabetical]);
  const paginationKey = JSON.stringify([countryCode || 'global', search.trim(), alphabetical]);
  const pageCount = Math.max(1, Math.ceil(genres.length / GENRES_PER_PAGE));
  const page = pagination.key === paginationKey ? Math.min(pagination.page, pageCount) : 1;
  const visibleGenres = useMemo(()=>genres.slice((page - 1) * GENRES_PER_PAGE, page * GENRES_PER_PAGE),[genres,page]);
  useEffect(() => { pageScroll.cancel(); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }, [paginationKey, pageScroll.cancel]);
  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pageCount) return;
    if (nextPage === page) return;
    setPagination({ key: paginationKey, page: nextPage });
    pageScroll.top();
  };
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.replace('/(tabs)')} accessibilityRole="button" accessibilityLabel={t('back', 'Back')}><Image source={require('../../assets/images/all-stations/back.svg')} style={{width:24,height:24}} tintColor="#FFFFFF" contentFit="contain" /></TouchableOpacity>
      {isLoaded&&(isGlobalCountry(country)||!!countryCode&&/^[a-z]{2}$/i.test(countryCode))&&<TouchableOpacity style={styles.iconButton} onPress={()=>setShowCountrySelector(true)} accessibilityRole="button" accessibilityLabel={country||t('country','Country')} accessibilityState={{expanded:showCountrySelector}} testID="genres-country-selector">
        {isGlobalCountry(country)?<CountryDiscoveryIcon size={28}/>:<CountryFlag code={countryCode} size={28}/>}
      </TouchableOpacity>}
      <Text pointerEvents="none" style={styles.title} numberOfLines={1}>{t('genres', 'Genres')}</Text>
      <TouchableOpacity style={[styles.iconButton,{marginLeft:'auto'}]} onPress={() => setAlphabetical(v => !v)} accessibilityRole="button" accessibilityLabel={t('sort', 'Sort')} accessibilityState={{ selected: alphabetical }} testID="genres-sort"><Image source={require('../../assets/images/genres/sort.svg')} style={{ width: 24, height: 24 }} tintColor={alphabetical ? '#FF4199' : '#FFFFFF'} /></TouchableOpacity>
    </View>
    <View key="genres-search-bar" style={styles.searchHeader}>
    <View testID="genres-search-field" style={[styles.search,searchFocus.fieldStyle]}>
      <Image testID="genres-search-icon" source={require('../../assets/images/home/search.svg')} style={{ width: 24, height: 24 }} tintColor="#616161" contentFit="contain" />
      <TextInput testID="genres-search-input" style={[styles.input,searchFocus.inputStyle]} selectionColor={searchFocus.selectionColor} onFocus={() => { searchFocus.onFocus(); setIsSearching(true); }} onBlur={() => { searchFocus.onBlur(); if (!search.trim()) setIsSearching(false); }} onKeyPress={event => { if (event.nativeEvent.key === 'Escape') closeSearch(); }} placeholder={t('search_genres', 'Search genres')} placeholderTextColor="#616161" value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" />
      {search !== '' && <TouchableOpacity testID="genres-search-clear" style={styles.clear} onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')}><Image source={require('../../assets/images/favorites/clear.svg')} style={{ width: 24, height: 24 }} /></TouchableOpacity>}
    </View>
    {isSearching && search.length > 0 && <TouchableOpacity testID="genres-search-cancel" style={styles.cancel} onPress={closeSearch} accessibilityRole="button"><Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>}
    </View>

    {isLoading ? <MegaLoadingState page variant="genres" count={8} style={{paddingTop:0}}/> : <FlatList initialNumToRender={GENRES_PER_PAGE} maxToRenderPerBatch={GENRES_PER_PAGE} updateCellsBatchingPeriod={0} ref={listRef} {...pageScroll.scrollProps} data={visibleGenres} keyExtractor={g => g.slug} testID="genres-list" contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#FF4199" />} ListFooterComponent={!isError && genres.length > 0 ? <CatalogPagination
      integrated page={page} pageCount={pageCount} onChange={changePage} testID="genres-pagination" idPrefix="genres-page"
      summary={`${(page - 1) * GENRES_PER_PAGE + 1}–${Math.min(page * GENRES_PER_PAGE, genres.length)} / ${genres.length} ${t('genres', 'Genres')}`} /> : null}
    renderItem={({ item }) => <TouchableOpacity style={styles.row} testID={`genre-item-${item.slug}`} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.stationCount ?? item.total_stations ?? 0} ${t('stations', 'Stations')}`} onPress={() => router.push({ pathname: '/genre-detail', params: { slug: item.slug, name: item.name } })}>
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text><Text style={styles.count}>{(item.stationCount ?? item.total_stations ?? 0).toLocaleString()}</Text>
    </TouchableOpacity>} ListEmptyComponent={search.trim() && !isError ? <SearchNoResults message={t('no_genres_found', 'No genres found')} /> : <View style={styles.empty}><Text style={styles.emptyText}>{isError ? t('error_loading', 'Unable to load genres') : t('no_genres_found', 'No genres found')}</Text>{isError && <TouchableOpacity onPress={() => refetch()}><Text style={styles.retry}>{t('retry', 'Retry')}</Text></TouchableOpacity>}</View>} />}
    <CountrySelectorModal visible={showCountrySelector} onClose={()=>setShowCountrySelector(false)}/>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 54, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { position:'absolute',left:96,right:96, textAlign: 'center', color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18 },
  searchHeader: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 11 },
  search: { flex: 1, height: 45, backgroundColor: '#F7F8FC', borderRadius: 10, paddingLeft: 15, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 15 },
  cancel: { minWidth: 50, height: 44, justifyContent: 'center' }, cancelText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17 },
  input: { flex: 1, minWidth:0, borderWidth:0, color: '#1B1C1E', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, height: 43, padding: 0 },
  clear: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingHorizontal: 15, paddingBottom: 24 },
  row: { minHeight: 71, borderBottomWidth: 1, borderBottomColor: '#292929', flexDirection: 'row', alignItems: 'center', paddingVertical: 20, gap: 12 },
  name: { flex: 1, fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 21, color: '#FFFFFF' },
  count: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 21, color: '#A6A6AA', fontVariant: ['tabular-nums'] },
  empty: { flex: 1, padding: 30, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#AAAAAA', fontFamily: 'Ubuntu-Regular', fontSize: 14 },
  retry: { color: '#FF4199', padding: 16, fontFamily: 'Ubuntu-Medium' },
});

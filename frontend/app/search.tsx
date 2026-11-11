import {MegaLoadingState} from '../src/components/MegaLoadingState';
import { STATION_SEARCH_VERSION } from '../src/utils/stationSearch';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable, Keyboard, FlatList, Platform, KeyboardAvoidingView, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { usePlayerStore } from '../src/store/playerStore';
import { useLocationStore } from '../src/store/locationStore';
import { isGlobalCountry } from '../src/utils/countryScope';
import { useRecentlyPlayedStore } from '../src/store/recentlyPlayedStore';
import { normalizeDirectory } from '../src/services/publicDirectoryService';
import { useRouter, useFocusEffect } from 'expo-router';
import stationService from '../src/services/stationService';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { getStationLogoUrl } from '../src/utils/stationLogoHelper';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import { AvatarWithFallback } from '../src/components/AvatarWithFallback';
import { SearchTelescope } from '../src/components/SearchTelescope';
import type { Station, Genre, GenreResponse } from '../src/types';
import api from '../src/services/api';
import { API_ENDPOINTS } from '../src/constants/api';

type Filter = 'radios' | 'genres' | 'profiles';
type Result = { _id: string; type: Filter; name: string; subtitle: string; imageUrl?: string | null; data: any };

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const input = useRef<TextInput>(null);
  const isMiniPlayerVisible = usePlayerStore(state => state.isMiniPlayerVisible);
  const { countryCode, country, countryEnglish, isLoaded: locationLoaded } = useLocationStore();
  const genreCountry = isGlobalCountry(countryEnglish || country) ? undefined : countryCode || undefined;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('radios');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { playStation, currentStation, playbackState, togglePlayPause } = useAudioPlayer();
  const recentStations = useRecentlyPlayedStore(state => state.stations);
  useEffect(() => { void useRecentlyPlayedStore.getState().loadFromStorage(); }, []);
  const term = query.trim();
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(term), 250); return () => clearTimeout(timer); }, [term]);
  const radioQuery = useQuery({
    queryKey: ['global-search-radios', STATION_SEARCH_VERSION, debouncedQuery],
    queryFn: ({signal}) => stationService.searchStations(debouncedQuery, 30, signal),
    enabled: filter === 'radios' && debouncedQuery.length >= 2, staleTime: 30000, retry: false,
  });
  const genreQuery = useQuery({
    queryKey: ['genres-catalog', genreCountry || 'global'], enabled: filter === 'genres' && locationLoaded, staleTime: 300000,
    queryFn: async () => {
      const page = async (number: number) => (await api.get<GenreResponse>(API_ENDPOINTS.genres.list, { params: { country: genreCountry, page: number, limit: 100 } })).data;
      const first = await page(1);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => page(i + 2)));
      return [...new Map<string, Genre>([first, ...rest].flatMap(result => result.data).map(genre => [genre.slug, genre])).values()];
    },
  });
  const profileQuery = useQuery({
    queryKey: ['global-search-profiles', debouncedQuery], enabled: filter === 'profiles', staleTime: 30000,
    queryFn: async () => normalizeDirectory((await api.get(API_ENDPOINTS.publicProfiles, { params: { search: debouncedQuery || undefined, limit: 100 } })).data),
  });
  const filtered = useMemo<Result[]>(() => {
    const lower = term.toLocaleLowerCase();
    if (filter === 'genres') return (genreQuery.data || []).filter(genre => genre.name.toLocaleLowerCase().includes(lower)).map(genre => ({ _id: genre._id || genre.slug, type: 'genres', name: genre.name, subtitle: '', data: genre }));
    if (filter === 'profiles') return (profileQuery.data || []).filter(profile => profile.name.toLocaleLowerCase().includes(lower)).map(profile => ({ _id: profile._id, type: 'profiles', name: profile.name, subtitle: `${profile.favorites_count ?? profile.favoriteStationsCount ?? 0} ${t('radios', 'Radios')}`, imageUrl: profile.profileImageUrl || profile.avatar || profile.profilePhoto, data: profile }));
    return (term ? radioQuery.data || [] : recentStations).map((station: Station) => ({ _id: station._id, type: 'radios', name: station.name, subtitle: station.genres?.[0] || station.tags?.split(',')[0]?.trim() || station.country || '', imageUrl: getStationLogoUrl(station), data: station }));
  }, [filter, term, genreQuery.data, profileQuery.data, radioQuery.data, recentStations, t]);
  const activeQuery = filter === 'genres' ? genreQuery : filter === 'profiles' ? profileQuery : radioQuery;
  const searching = (filter !== 'genres' && term !== debouncedQuery) || ((filter !== 'radios' || term.length >= 2) && activeQuery.isPending);
  const failed = activeQuery.isError;
  const searched = !!term || filter !== 'radios';

  useFocusEffect(useCallback(() => {
    const focus = InteractionManager.runAfterInteractions(() => input.current?.focus());
    return () => focus.cancel();
  }, []));


  const open = (item: Result) => {
    if (item.type === 'radios') { void playStation(item.data); return; }
    Keyboard.dismiss();
    if (item.type === 'genres') router.push({ pathname: '/genre-detail', params: { slug: item.data.slug, name: item.name } });
    else router.push({ pathname: '/user-profile', params: { userId: item._id, userName: item.name, userSlug: item.data.slug || '', userAvatar: item.imageUrl || '' } });
  };
  const clear = () => { setQuery(''); setDebouncedQuery(''); input.current?.focus(); };
  const cancel = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  const filters: { key: Filter; label: string }[] = [
    { key: 'radios', label: t('filter_radios', 'Radios') },
    { key: 'genres', label: t('filter_genres', 'Genres') },
    { key: 'profiles', label: t('filter_profiles', 'Profiles') },
  ];

  return <View style={styles.container}>
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        <View style={[styles.header, { paddingHorizontal: 15 }]}>
          <View style={styles.searchBox}>
            <Image source={require('../assets/images/home/search.svg')} style={styles.searchIcon} tintColor="#616161" />
            <TextInput ref={input} style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]} value={query} onChangeText={setQuery}
              placeholder={t('search_radio_user', 'Search radio, user')} placeholderTextColor="#5B5B5B"
              autoFocus maxLength={100} keyboardAppearance="dark" returnKeyType="search" autoCapitalize="none" autoCorrect={false}
              onSubmitEditing={() => Keyboard.dismiss()} testID="search-input" accessibilityLabel={t('search', 'Search')} />
            <TouchableOpacity style={styles.clear} onPress={clear} accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')} testID="search-clear">
              <Image source={require('../assets/images/favorites/clear.svg')} style={styles.searchIcon} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={cancel} style={styles.cancel} accessibilityRole="button" testID="search-cancel">
            <Text style={styles.cancelText}>{t('cancel', 'Cancel')}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.filters, { paddingHorizontal: 15 }]}>
          {filters.map(item => <Pressable key={item.key} style={[styles.chip, filter === item.key && styles.activeChip]}
            accessibilityRole="button" accessibilityState={{ selected: filter === item.key }}
            onPress={() => setFilter(item.key)} testID={`filter-${item.key}`}><Text style={styles.chipText}>{item.label}</Text></Pressable>)}
        </View>
        <View style={styles.content}>
          {searching ? <MegaLoadingState page variant={filter==='radios'?'station-list':filter==='profiles'?'people':'settings'} count={6}/> : filtered.length ?
            <FlatList style={styles.resultList} testID="search-results-list" data={filtered} keyExtractor={item => `${item.type}-${item._id}`} keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 16 + (isMiniPlayerVisible && currentStation ? 71 : 0), gap: filter === 'radios' ? 15 : 0 }}
              renderItem={({ item }) => <Pressable style={item.type === 'radios' ? styles.radio : styles.textRow}
                onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={item.name} testID={`search-result-${item._id}`}>
                {item.type === 'radios' && <ImageWithFallback uri={item.imageUrl} style={styles.logo} contentFit="contain" />}
                {item.type === 'profiles' && <AvatarWithFallback uri={item.imageUrl} size={40} />}
                <View style={styles.info}><Text style={[styles.name, item.type === 'genres' && styles.genreName]} numberOfLines={1}>{item.name}</Text>
                  {!!item.subtitle && <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>}</View>
                {item.type === 'genres' && <Text style={styles.genreCount} testID={`search-genre-count-${item.data.slug}`}>{(item.data.stationCount ?? item.data.total_stations ?? 0).toLocaleString()}</Text>}
                {item.type === 'radios' && <TouchableOpacity style={styles.playButton} accessibilityRole="button"
                  accessibilityLabel={currentStation?._id === item._id && playbackState === 'playing' ? t('pause', 'Pause') : `${t('play', 'Play')} ${item.name}`}
                  testID={`search-play-${item._id}`} onPress={event => {
                    event.stopPropagation();
                    if (currentStation?._id === item._id && playbackState === 'playing') void togglePlayPause();
                    else void playStation(item.data);
                  }}>
                  {currentStation?._id === item._id && (playbackState === 'loading' || playbackState === 'buffering') ?
                    <ActivityIndicator size="small" color="#FFFFFF" /> : currentStation?._id === item._id && playbackState === 'playing' ?
                    <Image source={require('../assets/images/mini-player/pause.svg')} style={styles.playIcon} contentFit="contain" accessible={false} /> :
                    <Image source={require('../assets/images/all-stations/play.svg')} style={styles.playIcon} contentFit="contain" accessible={false} />}
                </TouchableOpacity>}

              </Pressable>} /> :
            <View style={styles.empty} testID={searched ? 'search-no-results' : 'search-initial'}>
              <SearchTelescope />
              <Text style={styles.emptyText}>{failed ? t('search_error', 'Unable to search. Please try again.') : searched ? t('no_results_found', "We couldn’t find any result!") : t('search_radio_user', 'Search radio, user')}</Text>
            </View>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1C1E' }, fill: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 37, gap: 15 },
  searchBox: { flex: 1, height: 45, borderRadius: 10, backgroundColor: '#F7F8FC', flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 6, gap: 15 },
  input: { flex: 1, minWidth: 0, color: '#000000', fontFamily: 'Ubuntu-Medium', fontSize: 15, height: 45, lineHeight: 17, padding: 0, outlineWidth: 0 },
  clear: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 44, justifyContent: 'center' }, cancelText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 15 },
  filters: { flexDirection: 'row', paddingTop: 20, gap: 16 },
  chip: { height: 28, paddingHorizontal: 15, backgroundColor: '#2F2F2F', borderRadius: 25, justifyContent: 'center' },
  activeChip: { backgroundColor: '#FF4199' }, chipText: { fontFamily: 'Ubuntu-Bold', fontSize: 12, color: '#FFFFFF' },
  content: { flex: 1, minHeight: 0, paddingTop: 20 },
  resultList: { flex: 1, minHeight: 0 },
  genreName: { fontSize: 18, lineHeight: 21 },
  genreCount: { color: '#A6A6AA', fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 21, fontVariant: ['tabular-nums'] },
  radio: { height: 80, flexDirection: 'row', alignItems: 'center', backgroundColor: '#262626', borderRadius: 10, padding: 15, gap: 15 },
  logo: { width: 50, height: 50, borderRadius: 5, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  info: { flex: 1, minWidth: 0 }, name: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17 },
  subtitle: { color: '#FFFFFF', fontFamily: 'Ubuntu-Regular', fontSize: 14, lineHeight: 16, marginTop: 6 },
  searchIcon: { width: 24, height: 24 },
  playIcon: { width: 26, height: 26 },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  textRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  emptyText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 24, textAlign: 'center' },
});

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, gradients, spacing, borderRadius, typography } from '../../src/constants/theme';
import { useLocationStore } from '../../src/store/locationStore';
import { useResponsive } from '../../src/hooks/useResponsive';
import { genreService } from '../../src/services/genreService';
import type { Genre } from '../../src/types';

const GENRES_CACHE_KEY = '@megaradio_genres_cache';
const GENRES_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const PAGE_SIZE = 30;

const getGenresCacheKey = (countryCode?: string | null) => {
  return countryCode ? `${GENRES_CACHE_KEY}_${countryCode}` : GENRES_CACHE_KEY;
};

export default function GenresTabScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { countryCode } = useLocationStore();
  
  // Responsive layout
  const responsive = useResponsive();
  const numColumns = responsive.isLargeTablet ? 4 : responsive.isTablet ? 3 : 2;

  // State
  const [genres, setGenres] = useState<Genre[]>([]);
  const [page, setPage] = useState(1);
  const [totalGenres, setTotalGenres] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<number | null>(null);
  const requestState = useRef({ generation: 0, busy: false });

  // Fetch genres with pagination
  const fetchGenres = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      requestState.current.generation++;
      requestState.current.busy = false;
    }
    if (requestState.current.busy) return;
    const generation = requestState.current.generation;
    requestState.current.busy = true;
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      setLoadError(null);
      console.log('[Genres] Fetching page:', pageNum, 'country:', countryCode);
      const data = await genreService.getGenres(pageNum, PAGE_SIZE, countryCode || undefined);
      if (generation !== requestState.current.generation) return;
      const newGenres = data.data;
      const total = data.total;

      console.log('[Genres] Got', newGenres.length, 'genres, total:', total);

      setTotalGenres(total);
      setPage(pageNum);
      setHasMore(newGenres.length === PAGE_SIZE && pageNum * PAGE_SIZE < total);

      if (reset) {
        setGenres(newGenres);
        // Cache first page
        try {
          const cacheKey = getGenresCacheKey(countryCode);
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            data: newGenres,
            total,
            timestamp: Date.now(),
          }));
        } catch (e) {
          console.log('[Genres] Cache error:', e);
        }
      } else {
        // Append new genres, avoiding duplicates
        setGenres(prev => {
          const existingIds = new Set(prev.map(g => g._id || g.slug));
          const uniqueNew = newGenres.filter((g: Genre) => !existingIds.has(g._id || g.slug));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (error) {
      if (generation !== requestState.current.generation) return;
      console.error('[Genres] Fetch error:', error);
      setLoadError(pageNum);
    } finally {
      if (generation === requestState.current.generation) {
        requestState.current.busy = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [countryCode]);

  // Load cached data on mount
  useEffect(() => {
    const generation = ++requestState.current.generation;
    requestState.current.busy = false;
    setGenres([]);
    setTotalGenres(0);
    setHasMore(false);
    setLoadError(null);
    setIsLoading(true);
    const loadCache = async () => {
      try {
        const cacheKey = getGenresCacheKey(countryCode);
        const cached = await AsyncStorage.getItem(cacheKey);
        if (generation !== requestState.current.generation) return false;
        if (cached) {
          const { data, total, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > GENRES_CACHE_TTL;
          if (!isStale && Array.isArray(data) && data.length > 0) {
            console.log('[Genres] Using cache:', data.length, 'genres');
            setGenres(data);
            setTotalGenres(total || data.length);
            setIsLoading(false);
            return true;
          }
        }
      } catch (e) {
        console.log('[Genres] Cache load error:', e);
      }
      return false;
    };

    loadCache().then(() => {
      if (generation !== requestState.current.generation) return;
      // Always fetch fresh data (but show cache first if available)
      setPage(1);
      fetchGenres(1, true);
    });
    return () => { requestState.current.generation++; };
  }, [countryCode, fetchGenres]);

  // Load more when reaching end
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !loadError && !searchQuery.trim() && !isLoading) {
      const nextPage = page + 1;
      fetchGenres(nextPage, false);
    }
  }, [isLoadingMore, hasMore, loadError, page, fetchGenres, searchQuery, isLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGenres(1, true);
    setRefreshing(false);
  };

  // Sort by station count and filter by search
  const filteredAndSortedGenres = useMemo(() => {
    let result = [...genres];
    
    // Sort by station count (most stations first)
    result.sort((a: any, b: any) => {
      const countA = a.stationCount || a.total_stations || 0;
      const countB = b.stationCount || b.total_stations || 0;
      return countB - countA;
    });
    
    // Filter by search
    if (searchQuery.trim()) {
      result = result.filter((g: any) => 
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  }, [genres, searchQuery]);

  const handleGenrePress = (genre: Genre) => {
    router.push({
      pathname: '/genre-detail',
      params: { slug: genre.slug, name: genre.name },
    });
  };

  // Calculate item width based on columns
  const { width: screenWidth } = useWindowDimensions();
  const genreItemWidth = useMemo(() => {
    const availableWidth = screenWidth - (responsive.sidePadding * 2);
    const totalGaps = 12 * (numColumns - 1); // 12px gap between columns
    return Math.floor((availableWidth - totalGaps) / numColumns);
  }, [screenWidth, responsive.sidePadding, numColumns]);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <TouchableOpacity
      style={[styles.genreRow, numColumns > 1 && { width: genreItemWidth, flex: undefined, marginBottom: 12 }]}
      onPress={() => handleGenrePress(item)}
      activeOpacity={0.7}
      data-testid={`genre-item-${item.slug}`}
    >
      <View style={styles.genreInfo}>
        <Text style={styles.genreName}>{item.name}</Text>
        <Text style={styles.genreCount}>
          {item.stationCount || (item as any).total_stations || 0} {t('stations', 'Stations')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (loadError) return (
      <TouchableOpacity style={styles.footerLoader} onPress={() => fetchGenres(loadError, loadError === 1)}>
        <Text style={styles.emptyText}>{t('error_loading', 'Unable to load.')} {t('retry', 'Try again')}</Text>
      </TouchableOpacity>
    );
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingMoreText}>{t('loading_more', 'Yükleniyor...')}</Text>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <LinearGradient colors={gradients.background as any} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('genres', 'Genres')}</Text>
            {totalGenres > 0 && (
              <Text style={styles.totalCount}>
                {genres.length} / {totalGenres}
              </Text>
            )}
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('search_genre', 'Tür ara')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                data-testid="genres-search-input"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Genre List */}
          {isLoading && genres.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredAndSortedGenres}
              renderItem={renderGenreItem}
              keyExtractor={(item: any) => item._id || item.slug}
              key={`genres-${numColumns}`}
              numColumns={numColumns}
              contentContainerStyle={[styles.listContent, { paddingHorizontal: responsive.sidePadding }]}
              columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
              onEndReached={loadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={renderFooter}
              ListEmptyComponent={loadError ? null :
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchQuery ? t('no_genres_found', 'No genres found') : t('no_genres', 'No genres available')}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  totalCount: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  genreInfo: {
    flex: 1,
  },
  genreName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  genreCount: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textMuted,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingMoreText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});

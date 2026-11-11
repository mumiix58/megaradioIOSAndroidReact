import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CategoryArtwork } from './CategoryArtwork';
import { useDiscoverableGenres, usePrecomputedGenres } from '../hooks/useQueries';
import { useLocationStore } from '../store/locationStore';

/** Home category artwork, presented as a single discovery row below favorites. */
export function FavoriteCategories() {
  const router = useRouter();
  const { t } = useTranslation();
  const { countryEnglish, country, isLoaded } = useLocationStore();
  const { data: featured } = useDiscoverableGenres();
  const { data: catalog } = usePrecomputedGenres(isLoaded ? countryEnglish || country || undefined : undefined);
  const categories = useMemo(() => {
    const seen = new Set<string>();
    return [...(featured || []), ...(catalog?.data || [])].filter(genre => {
      if (!genre.slug || seen.has(genre.slug)) return false;
      seen.add(genre.slug);
      return true;
    }).slice(0, 4);
  }, [featured, catalog]);

  if (!categories.length) return null;
  return <View style={styles.section} testID="favorites-categories">
    <View style={styles.heading}>
      <Text style={styles.title}>{t('categories', 'Categories')}</Text>
      <TouchableOpacity testID="favorites-categories-see-all" accessibilityRole="button" onPress={() => router.navigate('/(tabs)/genres')} style={styles.seeAll}>
        <Text style={styles.link}>{t('homepage_see_all', 'See all')}</Text>
      </TouchableOpacity>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} directionalLockEnabled testID="favorites-categories-row">
      {categories.map((genre, index) => <TouchableOpacity key={genre.slug} style={styles.card} activeOpacity={0.8}
        accessibilityRole="button" accessibilityLabel={genre.name} testID={`favorites-category-${genre.slug}`}
        onPress={() => router.push({ pathname: '/genre-detail', params: { slug: genre.slug, name: genre.name } })}>
        <CategoryArtwork slug={genre.slug} index={index} />
        <Text style={styles.name} numberOfLines={2}>{genre.name}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 20, marginBottom: 12 },
  heading: { paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 },
  title: { flex: 1, color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 24 },
  seeAll: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#FF4199', fontFamily: 'Ubuntu-Medium', fontSize: 14 },
  row: { paddingHorizontal: 15, gap: 15 },
  card: { width: 165, height: 119, borderRadius: 5, overflow: 'hidden', backgroundColor: '#32303E', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 24, paddingHorizontal: 12, textAlign: 'center' },
});

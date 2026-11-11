import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStationRatings } from '../hooks/useStationRatings';

export const StationRatingSummary = ({ stationId, name }: { stationId: string; name: string }) => {
  const ratings = useStationRatings(stationId);
  return <RatingEditor key={ratings.scope} ratings={ratings} name={name} />;
};
function RatingEditor({ ratings, name }: { ratings: ReturnType<typeof useStationRatings>; name: string }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const dirty = useRef(false);
  useEffect(() => { if (open && !dirty.current) setDraft(ratings.own.data?.rating ?? 0); }, [open, ratings.own.data?.rating]);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'rating', visible: open }, 'http://localhost:8082');
      return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'rating', visible: false }, 'http://localhost:8082');
    }
  }, [open]);
  const average = ratings.stats.data?.averageRating ?? 0;
  const total = ratings.stats.data?.totalRatings ?? 0;
  const format = new Intl.NumberFormat(i18n.language || 'en');
  const openEditor = () => {
    dirty.current = false; setDraft(ratings.own.data?.rating ?? 0); setFailed(false); setOpen(true);
    if (ratings.own.isError) void ratings.own.refetch();
    if (ratings.stats.isError) void ratings.stats.refetch();
  };
  const save = async () => {
    if (pending || !draft) return;
    setPending(true); setFailed(false);
    try { await ratings.submit(draft); setOpen(false); } catch { setFailed(true); } finally { setPending(false); }
  };
  const caption = ratings.stats.isPending ? t('rating_loading', 'Loading ratings…') : ratings.stats.isError ? t('rating_unavailable', 'Ratings unavailable') : total === 0 ? t('rating_no_ratings', 'No ratings yet') : `${new Intl.NumberFormat(i18n.language || 'en', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(average)} · ${t('rating_count', { count: total, formattedCount: format.format(total), defaultValue: '{{formattedCount}} ratings' })}`;
  return <>
    <TouchableOpacity style={styles.summary} onPress={openEditor} accessibilityRole="button" accessibilityLabel={`${t('rate_station', 'Rate this station')}. ${caption}`} testID="player-rating-summary">
      <View style={styles.summaryStars}>{[1,2,3,4,5].map(value => <Ionicons key={value} name={average >= value ? 'star' : average >= value - 0.5 ? 'star-half' : 'star-outline'} size={15} color={average > 0 ? '#F5C451' : '#A6A6A6'} />)}</View>

    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!pending) setOpen(false); }}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!pending) setOpen(false); }} accessibilityRole="button" accessibilityLabel={t('close', 'Close')} />
        <View style={[styles.panel, { paddingBottom: Math.max(24, insets.bottom + 16) }]} testID="station-rating-panel">
          <View style={styles.heading}><Text style={styles.title}>{t('rate_station', 'Rate this station')}</Text><TouchableOpacity style={styles.close} onPress={() => setOpen(false)} disabled={pending} accessibilityRole="button" accessibilityLabel={t('close', 'Close')}><Ionicons name="close" size={22} color="#FFFFFF" /></TouchableOpacity></View>
          <Text style={styles.stationName} numberOfLines={2}>{name}</Text>
          <View style={styles.editorStars}>{[1,2,3,4,5].map(value => <TouchableOpacity key={value} style={styles.starTouch} onPress={() => { dirty.current = true; setDraft(value); }} disabled={pending || ratings.own.isPending || ratings.own.isError} accessibilityRole="button" accessibilityState={{ selected: draft === value, disabled: pending || ratings.own.isPending || ratings.own.isError }} accessibilityLabel={t('rating_stars', { count: value, defaultValue: '{{count}} stars' })} testID={`rating-star-${value}`}><Ionicons name={draft >= value ? 'star' : 'star-outline'} size={30} color="#F5C451" /></TouchableOpacity>)}</View>
          {ratings.own.isPending && <ActivityIndicator color="#FF4199" />}
          {ratings.own.isError && <TouchableOpacity onPress={() => void ratings.own.refetch()}><Text style={styles.error}>{t('rating_retry', 'Could not load your rating. Tap to retry.')}</Text></TouchableOpacity>}
          {failed && <Text style={styles.error} accessibilityRole="alert">{t('rating_save_failed', 'Could not save your rating. Please try again.')}</Text>}
          <TouchableOpacity style={[styles.save, (!draft || pending || ratings.own.isPending || ratings.own.isError) && styles.disabled]} onPress={() => void save()} disabled={!draft || pending || ratings.own.isPending || ratings.own.isError} accessibilityRole="button" testID="rating-save">{pending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{t('rating_save', 'Save rating')}</Text>}</TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  summary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3, maxWidth: 180 },
  summaryStars: { flexDirection: 'row', gap: 3 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: { backgroundColor: '#171717', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 24, paddingTop: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Ubuntu-Bold', fontSize: 18, color: '#FFFFFF', flexShrink: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stationName: { fontFamily: 'Ubuntu-Regular', fontSize: 14, color: '#A6A6A6', marginTop: 4 },
  editorStars: { flexDirection: 'row', justifyContent: 'center', marginVertical: 22 },
  starTouch: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  save: { height: 48, borderRadius: 8, backgroundColor: '#FF4199', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveText: { fontFamily: 'Ubuntu-Bold', fontSize: 15, color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  error: { color: '#FFA1C9', fontFamily: 'Ubuntu-Regular', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
});

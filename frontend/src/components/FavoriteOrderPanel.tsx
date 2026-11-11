import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Animated, PanResponder, FlatList, Platform} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ImageWithFallback } from './ImageWithFallback';
import { getStationLogoUrl } from '../utils/stationLogoHelper';
import type { Station } from '../types';

import { moveFavorite } from '../utils/favoriteOrdering';
function OrderRow({ item, index, count, onMove, onDragging }: { item: Station; index: number; count: number; onMove: (from: number, to: number) => void; onDragging: (value: boolean) => void }) {
  const { t } = useTranslation();
  const translateY = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);
  const latest = useRef({ index, count, onMove, onDragging }); latest.current = { index, count, onMove, onDragging };
  const finish = (dy: number) => {
    const current = latest.current;
    translateY.setValue(0); setActive(false); current.onDragging(false);
    current.onMove(current.index, Math.max(0, Math.min(current.count - 1, current.index + Math.round(dy / 95))));
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => { setActive(true); latest.current.onDragging(true); },
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(-latest.current.index * 95, Math.min((latest.current.count - latest.current.index - 1) * 95, gesture.dy))),
    onPanResponderRelease: (_, gesture) => finish(gesture.dy),
    onPanResponderTerminate: () => { translateY.setValue(0); setActive(false); latest.current.onDragging(false); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  // Browser pointer capture keeps image dragging/selection from stealing the gesture.
  const pointer = useRef<{ id: number; y: number } | null>(null);
  const webGesture = {
    onPointerDown: (event: any) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault(); pointer.current = { id: event.pointerId, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId); setActive(true); onDragging(true);
    },
    onPointerMove: (event: any) => {
      if (!pointer.current || pointer.current.id !== event.pointerId) return;
      translateY.setValue(Math.max(-index * 95, Math.min((count - index - 1) * 95, event.clientY - pointer.current.y)));
    },
    onPointerUp: (event: any) => {
      if (!pointer.current || pointer.current.id !== event.pointerId) return;
      const dy = event.clientY - pointer.current.y; pointer.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId); finish(dy);
    },
    onPointerCancel: () => { pointer.current = null; translateY.setValue(0); setActive(false); onDragging(false); },
    onLostPointerCapture: () => { if (pointer.current) { pointer.current = null; translateY.setValue(0); setActive(false); onDragging(false); } },
  };
  const keyboard = Platform.OS === 'web' ? { onKeyDown: (event: any) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); onMove(index, index + (event.key === 'ArrowUp' ? -1 : 1)); }
  } } : {};
  return <Animated.View testID={`favorite-order-row-${item._id}`} style={[s.card, active && s.active, { transform: [{ translateY }] }]}>
    <ImageWithFallback uri={getStationLogoUrl(item)} style={s.logo} />
    <View style={s.info}><Text style={s.name} numberOfLines={1}>{item.name}</Text><Text style={s.genre} numberOfLines={1}>{item.genres?.[0] || 'Radio'}</Text></View>
    <View {...(Platform.OS === 'web' ? webGesture : responder.panHandlers)} style={[s.drag, Platform.OS === 'web' && ({ touchAction: 'none' } as any)]}>
      <Pressable {...keyboard} style={s.dragTouch} testID={`favorite-order-handle-${item._id}`} accessibilityRole="adjustable" accessibilityLabel={t('reorder_station', 'Reorder {{name}}', { name: item.name })} accessibilityValue={{ min: 1, max: count, now: index + 1 }} aria-valuemin={1} aria-valuemax={count} aria-valuenow={index + 1} accessibilityActions={[{ name: 'increment', label: t('move_down', 'Move down') }, { name: 'decrement', label: t('move_up', 'Move up') }]} onAccessibilityAction={event => onMove(index, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
        <Image source={require('../../assets/images/favorites/reorder.svg')} style={s.icon} pointerEvents="none" />
      </Pressable>
    </View>
  </Animated.View>;
}
export function FavoriteOrderPanel({ items, onCancel, onSave }: { items: Station[]; onCancel: () => void; onSave: (items: Station[]) => Promise<void> }) {
  const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(items); const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const saving = useRef(false);
  const move = (from: number, to: number) => { if (saving.current) return; setDraft(previous => moveFavorite(previous, from, to)); };
  const save = async () => {
    if (saving.current) return; saving.current = true; setBusy(true); setError('');
    try { await onSave(draft); } catch { setError(t('save_failed', 'Could not save. Please try again.')); }
    finally { saving.current = false; setBusy(false); }
  };
  return <View style={s.overlay}><Pressable testID="favorite-order-backdrop" style={StyleSheet.absoluteFill} onPress={() => { if (!busy) onCancel(); }} accessible={false} />
    <View style={[s.panel, { marginTop: 55 + insets.top }]} accessibilityViewIsModal testID="favorite-order-panel">
      <View style={s.grabberArea}><View style={s.grabber} /></View>
      <FlatList testID="favorite-order-list" data={draft} keyExtractor={item => item._id} scrollEnabled={!dragging && !busy} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list} renderItem={({ item, index }) => <OrderRow item={item} index={index} count={draft.length} onMove={move} onDragging={setDragging} />} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={[s.actions, { paddingBottom: 15 + insets.bottom }]}><TouchableOpacity testID="favorite-order-cancel" accessibilityRole="button" disabled={busy} onPress={onCancel} style={s.buttonTouch}><View style={s.cancel}><Text style={s.buttonText}>{t('cancel', 'Cancel')}</Text></View></TouchableOpacity><TouchableOpacity testID="favorite-order-save" accessibilityRole="button" disabled={busy} onPress={() => void save()} style={s.buttonTouch}><View style={s.save}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.buttonText}>{t('save', 'Save')}</Text>}</View></TouchableOpacity></View>
    </View>
  </View>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }, panel: { flex: 1, backgroundColor: '#000000', borderTopLeftRadius: 20, borderTopRightRadius: 20 }, grabberArea: { height: 46, paddingTop: 20, alignItems: 'center' }, grabber: { width: 50, height: 6, borderRadius: 3, backgroundColor: '#676767' }, list: { paddingHorizontal: 15, paddingBottom: 15 },
  card: { height: 80, marginBottom: 15, paddingLeft: 15, paddingRight: 13, backgroundColor: '#262626', borderRadius: 10, flexDirection: 'row', alignItems: 'center' }, active: { zIndex: 5, elevation: 8, opacity: 0.95 }, logo: { width: 50, height: 50, borderRadius: 5 }, info: { flex: 1, marginLeft: 15 }, name: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17, marginBottom: 6 }, genre: { color: '#BFBFBF', fontFamily: 'Ubuntu-Regular', fontSize: 14, lineHeight: 16 }, drag: { width: 44, height: 44 }, dragTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, icon: { width: 24, height: 24 },
  actions: { minHeight: 86, paddingTop: 27, flexDirection: 'row', justifyContent: 'center', gap: 16, backgroundColor: '#000000' }, buttonTouch: { minWidth: 59, height: 44, alignItems: 'center', justifyContent: 'center' }, cancel: { height: 27, minWidth: 59, borderRadius: 10, borderWidth: 2, borderColor: '#3F3F3F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }, save: { height: 27, minWidth: 59, borderRadius: 10, backgroundColor: '#FF4199', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 }, buttonText: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15, color: '#FFFFFF' }, error: { fontFamily: 'Ubuntu-Regular', fontSize: 13, color: '#FF8DBD', textAlign: 'center', padding: 10 },
});

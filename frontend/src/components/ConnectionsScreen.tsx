import { useMegaSearchFocus } from '../hooks/useMegaSearchFocus';
import {MegaLoadingState} from './MegaLoadingState';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Pressable, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { API_ENDPOINTS } from '../constants/api';
import { useAuthStore } from '../store/authStore';
import { AvatarWithFallback } from './AvatarWithFallback';
import { ConnectionKind, ConnectionUser, normalizeConnections, connectionMatches, connectionRemoval } from '../utils/connections';

interface Props { kind: ConnectionKind; onBack: () => void; previewRows?: ConnectionUser[]; onPreviewRemove?: (id: string) => void; onCountChange?: (count: number) => void; }
export function ConnectionsScreen({ kind, onBack, previewRows, onPreviewRemove, onCountChange }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const ownerId = useAuthStore(s => s.user?._id || s.user?.id);
  const authenticated = useAuthStore(s => s.isAuthenticated);
  const [rows, setRows] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState('');
  const searchFocus = useMegaSearchFocus();
  const searchInput = useRef<TextInput>(null);
  const [pending, setPending] = useState<ConnectionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const lastPending = useRef<ConnectionUser | null>(null);
  const generation = useRef(0);
  const page = useRef(0);
  const pages = useRef(1);
  const total = useRef(0);
  const fetching = useRef(false);
  const removing = useRef(false);
  const callbacks = useRef({ onCountChange }); callbacks.current = { onCountChange };
  const isPreview = previewRows !== undefined;
  const title = kind === 'followers' ? t('followers', 'Followers') : t('follows', 'Follows');
  const action = kind === 'followers' ? t('remove', 'Remove') : t('unfollow', 'Unfollow');
  const routeName = kind === 'followers' ? 'followers' : 'follows';
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => subscription.remove();
  }, [onBack]));
  const load = useCallback(async (reset = false) => {
    if (!ownerId || !authenticated || isPreview || (!reset && (fetching.current || page.current >= pages.current))) return;
    const request = generation.current;
    fetching.current = true;
    if (reset) setLoading(true); else setMoreLoading(true);
    setError('');
    try {
      const nextPage = reset ? 1 : page.current + 1;
      const endpoint = API_ENDPOINTS.user.connections(kind);
      const response = await api.get(endpoint, { params: { page: nextPage, limit: 100 } });
      const next = normalizeConnections(response.data, kind);
      if (generation.current !== request) return;
      page.current = nextPage;
      pages.current = Number(response.data?.pagination?.pages) || 1;
      setRows(previous => reset ? next : [...previous, ...next.filter(item => !previous.some(old => old._id === item._id))]);
      const count = response.data?.pagination?.total;
      total.current = typeof count === 'number' ? count : next.length;
      callbacks.current.onCountChange?.(total.current);
    } catch {
      if (generation.current === request) setError(t('connections_load_error', 'Could not load this list. Please try again.'));
    } finally {
      if (generation.current === request) { fetching.current = false; setLoading(false); setMoreLoading(false); }
    }
  }, [ownerId, authenticated, kind, isPreview, t]);
  useEffect(() => {
    generation.current++; page.current = 0; pages.current = 1; fetching.current = false;
    setRows([]); setPending(null); setQuery(''); setSearchVisible(false);
    if (isPreview || !ownerId || !authenticated) { setLoading(false); setError(''); }
    else void load(true);
    return () => { generation.current++; };
  }, [load]);
  // Search also checks subsequent pages, rather than silently searching only page one.
  useEffect(() => { if (query.trim() && !loading && !moreLoading && !error && page.current < pages.current) void load(); }, [query, loading, moreLoading, rows, error, load]);
  const dismiss = () => { if (!removing.current) setPending(null); };
  const confirm = async () => {
    if (!pending || removing.current || !ownerId || !authenticated) return;
    const item = pending, request = generation.current;
    removing.current = true; setBusy(true); setError('');
    try {
      if (isPreview) onPreviewRemove?.(item._id);
      else {
        if (item._id.startsWith('preview-')) throw new Error('Preview ID cannot reach API');
        const requestConfig = connectionRemoval(kind, item._id);
        const response = await api.request(requestConfig);
        if (response.data?.success !== true) throw new Error('Removal was not confirmed');
        if (generation.current !== request) return;
        setRows(previous => previous.filter(user => user._id !== item._id));
        total.current = Math.max(0, total.current - 1);
        callbacks.current.onCountChange?.(total.current);
        // Deleting a relationship changes subsequent page offsets. Refresh page one.
        void load(true);
      }
      if (generation.current === request) setPending(null);
    } catch {
      if (generation.current === request) setError(t('connections_remove_error', 'Could not update this connection. Please try again.'));
    } finally { removing.current = false; if (generation.current === request) setBusy(false); }
  };
  const visibleRows = (previewRows ?? rows).filter(user => connectionMatches(user, query));
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.header}>
      <TouchableOpacity testID={`${routeName}-back-btn`} onPress={onBack} style={s.headerTouch} accessibilityRole="button" accessibilityLabel={t('back', 'Back')}><Image source={require('../../assets/images/language/back.svg')} style={s.icon} /></TouchableOpacity>
      <Text style={s.title}>{title}</Text>
      <TouchableOpacity testID={`${routeName}-search-btn`} style={[s.headerTouch, s.searchTouch]} onPress={() => { setSearchVisible(!searchVisible); setQuery(''); }} accessibilityRole="button" accessibilityLabel={t('search', 'Search')} accessibilityState={{ expanded: searchVisible }}><Image source={require('../../assets/images/home/search.svg')} style={s.icon} /></TouchableOpacity>
    </View>
    {searchVisible && <View style={s.searchContainer}><View testID={`${routeName}-search-field`} style={[s.searchField, searchFocus.fieldStyle]}><TextInput ref={searchInput} testID={`${routeName}-search-input`} style={[s.searchInput,searchFocus.inputStyle]} onFocus={searchFocus.onFocus} onBlur={searchFocus.onBlur} selectionColor={searchFocus.selectionColor} value={query} onChangeText={setQuery} placeholder={t('search', 'Search')} placeholderTextColor="#666666" autoFocus returnKeyType="search" clearButtonMode="never" accessibilityLabel={t('search', 'Search')} />
      <TouchableOpacity style={s.searchClear} onPress={() => { setQuery(''); searchInput.current?.focus(); }} accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')} testID={`${routeName}-search-clear`}>
        <Image source={require('../../assets/images/favorites/clear.svg')} style={s.searchClearIcon} contentFit="contain" />
      </TouchableOpacity></View></View>}
    {error && !pending && <View style={s.error}><Text style={s.errorText}>{error}</Text><TouchableOpacity onPress={() => void load(page.current === 0)} accessibilityRole="button"><Text style={s.retry}>{t('retry', 'Retry')}</Text></TouchableOpacity></View>}
    {loading ? <MegaLoadingState page variant="people"/> : <FlatList testID={`${routeName}-list`} data={visibleRows} keyExtractor={item => item._id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" onEndReached={() => void load()} onEndReachedThreshold={0.3} ListFooterComponent={moreLoading ? <ActivityIndicator color="#FF4199" /> : null} ListEmptyComponent={error ? null : <Text style={s.empty}>{!authenticated ? t('login_required', 'Login Required') : query ? t('no_results', 'No results found') : kind === 'followers' ? t('no_followers', 'No followers yet') : t('no_following', 'Not following anyone yet')}</Text>} renderItem={({ item, index }) => <View style={[s.row, index === 0 && s.firstRow]} testID={`connection-row-${item._id}`}>
      <TouchableOpacity style={s.person} hitSlop={{ top: 6, bottom: 6 }} disabled={isPreview} accessibilityRole={isPreview ? undefined : 'button'} onPress={() => router.push({ pathname: '/user-profile', params: { userId: item._id, userName: item.fullName || item.username, userAvatar: item.avatar || '' } })} testID={`connection-profile-${item._id}`}>
        {isPreview ? <Image source={require('../fixtures/connections').connectionPreviewAvatars[Number(item._id.split('-').pop())]} style={s.avatar} /> : <AvatarWithFallback uri={item.avatar} size={32} />}
        <Text style={s.name} numberOfLines={1}>{item.fullName || item.username}</Text>
      </TouchableOpacity>
      <TouchableOpacity testID={`connection-remove-${item._id}`} accessibilityRole="button" accessibilityLabel={`${action} ${item.fullName || item.username}`} onPress={() => { setError(''); lastPending.current = item; setPending(item); }} style={s.actionTouch}><View style={[s.pill, { minWidth: kind === 'followers' ? 67 : 74 }]}><Text style={s.actionText}>{action}</Text></View></TouchableOpacity>
    </View>} />}
    <Modal visible={!!pending} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}><View style={s.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={dismiss} testID="connection-confirm-backdrop" accessible={false} /><View style={s.dialog} accessibilityViewIsModal onAccessibilityEscape={dismiss} testID="connection-confirm-dialog"><Text style={s.dialogTitle}>{action}</Text><Text style={s.dialogMessage}>{kind === 'followers' ? t('remove_follower_confirm', 'Are you sure you want to remove this follower?') : t('unfollow_user_confirm', 'Stop following {{name}}?', { name: (pending || lastPending.current)?.fullName || (pending || lastPending.current)?.username })}</Text>{error ? <Text style={s.errorText}>{error}</Text> : null}<View style={s.actions}><TouchableOpacity style={s.dialogTouch} accessibilityRole="button" onPress={dismiss} disabled={busy} testID="connection-confirm-cancel"><View style={s.cancelPill}><Text style={s.actionText}>{t('cancel', 'Cancel')}</Text></View></TouchableOpacity><TouchableOpacity style={s.dialogTouch} accessibilityRole="button" onPress={() => void confirm()} disabled={busy} testID="connection-confirm-ok"><View style={s.pill}>{busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.actionText}>{action}</Text>}</View></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTouch: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' }, searchTouch: { alignItems: 'flex-end' }, icon: { width: 24, height: 24 },
  title: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21, color: '#FFFFFF', position: 'absolute', left: 60, right: 60, textAlign: 'center' },
  list: { paddingHorizontal: 15, paddingTop: 1, paddingBottom: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  row: { height: 53, marginBottom: 17, borderBottomWidth: 1, borderBottomColor: '#292A2C', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, firstRow: { marginBottom: 15 },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 32 }, avatar: { width: 32, height: 32, borderRadius: 50 }, name: { flex: 1, fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15, color: '#FFFFFF' },
  actionTouch: { minHeight: 44, justifyContent: 'center', marginTop: -6.5 }, pill: { backgroundColor: '#FF4199', minWidth: 67, height: 27, paddingHorizontal: 9, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }, actionText: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15, color: '#FFFFFF' },
  searchContainer: { paddingHorizontal: 15, paddingBottom: 16 }, searchField: { height:44, borderWidth:1, borderColor:'transparent', borderRadius:10, backgroundColor:'#FFFFFF', flexDirection:'row', alignItems:'center', paddingRight:6, overflow:'hidden' }, searchClear: {width:36,height:44,alignItems:'center',justifyContent:'center'}, searchClearIcon: {width:24,height:24}, searchInput: { flex:1,minWidth:0,borderWidth:0, height:42, borderRadius:9, backgroundColor:'transparent', color: '#1B1C1E', fontFamily: 'Ubuntu-Regular', fontSize: 15, paddingHorizontal: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, empty: { color: '#9C9C9C', fontFamily: 'Ubuntu-Regular', fontSize: 14, textAlign: 'center', paddingVertical: 60 }, error: { padding: 15 }, errorText: { color: '#FF8DBD', fontFamily: 'Ubuntu-Regular', fontSize: 13, textAlign: 'center' }, retry: { fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', textAlign: 'center', padding: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 }, dialog: { width: 302, maxWidth: '100%', backgroundColor: '#000000', borderWidth: 1, borderColor: '#292929', borderRadius: 6, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 }, dialogTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 20, lineHeight: 23, color: '#FFFFFF', textAlign: 'center', marginBottom: 10 }, dialogMessage: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, color: '#FFFFFF', textAlign: 'center', marginBottom: 20 }, actions: { flexDirection: 'row', justifyContent: 'center', gap: 30 }, dialogTouch: { minWidth: 67, height: 44, justifyContent: 'center' }, cancelPill: { height: 27, borderRadius: 30, borderWidth: 2, borderColor: '#3F3F3F', paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
});

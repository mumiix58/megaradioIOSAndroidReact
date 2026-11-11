import {MegaRefreshControl} from './MegaRefreshControl';
import {MegaLoadingState} from './MegaLoadingState';
import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AvatarWithFallback } from './AvatarWithFallback';
import { usePublicDirectory } from '../hooks/usePublicDirectory';
import { useDirectoryFollowing } from '../hooks/useDirectoryFollowing';
import { useMegaSearchFocus } from '../hooks/useMegaSearchFocus';
import { usePlayerStore } from '../store/playerStore';
import type { PublicDirectoryUser } from '../services/publicDirectoryService';

export default function UsersDirectory() {
  const router = useRouter();
  const { t } = useTranslation();
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const input = useRef<TextInput>(null);
  const searchFocus = useMegaSearchFocus();
  const directory = usePublicDirectory();
  const [visibleIds,setVisibleIds]=useState<string[]>([]);
  const [focused,setFocused]=useState(false);
  useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
  const viewabilityConfig=useRef({itemVisiblePercentThreshold:10,minimumViewTime:80}).current;
  const onViewableItemsChanged=useRef(({viewableItems}:{viewableItems:ViewToken<PublicDirectoryUser>[]})=>{
    const ids=viewableItems.filter(row=>row.isViewable).map(row=>row.item._id);
    setVisibleIds(previous=>previous.join('|')===ids.join('|')?previous:ids);
  }).current;
  const statusIds=useMemo(()=>visibleIds.length?visibleIds:directory.profiles.slice(0,10).map(user=>user._id),[visibleIds,directory.profiles]);
  const following = useDirectoryFollowing(statusIds, focused);
  const hasMiniPlayer = usePlayerStore(state => state.isMiniPlayerVisible && !!state.currentStation);
  const users = useMemo(() => directory.profiles.filter(user => user.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [directory.profiles, search]);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'users', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const closeSearch = () => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); };
  const open = (user: PublicDirectoryUser) => router.push({ pathname: '/user-profile', params: {
    userId: user._id, userName: user.name, userSlug: user.slug || '',
    userAvatar: user.profileImageUrl || user.profilePhoto || user.avatar || '',
  } });
  const follow = async (id: string) => {
    if (!following.owner) { router.push({ pathname: '/auth-options', params: { returnTo: '/users' } }); return; }
    try { await following.toggle(id); }
    catch { Alert.alert(t('error', 'Error'), t('follow_error', 'İşlem tamamlanamadı. Tekrar deneyin.')); }
  };
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']} testID="users-directory">
    <View style={s.header}>
      <TouchableOpacity testID="community-back" accessibilityRole="button" accessibilityLabel={t('back', 'Back')} style={s.iconTouch} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
        <Image source={require('../../assets/images/all-stations/back.svg')} style={s.icon} contentFit="contain" />
      </TouchableOpacity>
      <Text style={s.title} testID="community-title">{t('users', 'Users')}</Text>
      <TouchableOpacity testID="users-search-toggle" accessibilityRole="button" accessibilityLabel={t('search_users', 'Search users...')} accessibilityState={{ expanded: searchVisible }} style={s.iconTouch} onPress={() => { if (searchVisible) closeSearch(); else setSearchVisible(true); }}>
        <Image source={require('../../assets/images/home/search.svg')} style={s.icon} contentFit="contain" />
      </TouchableOpacity>
    </View>
    {searchVisible && <View style={s.searchHeader}>
      <View testID="users-search-field" style={[s.searchBox, searchFocus.fieldStyle]}>
        <Image source={require('../../assets/images/home/search.svg')} style={s.icon} tintColor="#616161" />
        <TextInput ref={input} testID="community-search" autoFocus style={[s.input, searchFocus.inputStyle]}
          onFocus={searchFocus.onFocus} onBlur={searchFocus.onBlur} selectionColor={searchFocus.selectionColor}
          value={search} onChangeText={setSearch} placeholder={t('search_users', 'Search users...')} placeholderTextColor="#616161"
          accessibilityLabel={t('search_users', 'Search users...')} autoCorrect={false} returnKeyType="search"
          onKeyPress={event => { if (event.nativeEvent.key === 'Escape') closeSearch(); }} />
        {!!search && <TouchableOpacity testID="community-clear-search" accessibilityRole="button" accessibilityLabel={t('clear', 'Clear')} style={s.clearTouch} onPress={() => { setSearch(''); input.current?.focus(); }}>
          <Image source={require('../../assets/images/favorites/clear.svg')} style={s.icon} />
        </TouchableOpacity>}
      </View>
      {!!search && <TouchableOpacity testID="users-search-cancel" accessibilityRole="button" style={s.cancelTouch} onPress={closeSearch}><Text style={s.cancelText}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>}
    </View>}
    {directory.isLoading ? <MegaLoadingState page variant="people" testID="community-loading" style={{paddingTop:0,maxWidth:630,width:'100%',alignSelf:'center'}}/> : <FlatList
      testID="community-list" data={users} initialNumToRender={10} maxToRenderPerBatch={8} windowSize={5} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} keyExtractor={user => user._id} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={[s.list, { paddingBottom: hasMiniPlayer ? 100 : 24 }]} refreshControl={<MegaRefreshControl refreshing={directory.isRefetching} onRefresh={() => void directory.refetch()}/> }
      ListEmptyComponent={<Text style={s.emptyText} testID="community-empty">{directory.error ? t('error_loading', 'Unable to load users') : t('no_users', 'No users found')}</Text>}
      ListFooterComponent={<View style={s.footer}>
        {directory.isFetchingNextPage ? <ActivityIndicator testID="community-loading-more" color="#FF4199" /> : directory.hasNextPage && <TouchableOpacity style={s.loadMore} testID="community-load-more" accessibilityRole="button" onPress={() => directory.fetchNextPage({cancelRefetch:false})}><Text style={s.cancelText}>{t('load_more', 'Load More')}</Text></TouchableOpacity>}
        {!!directory.error && <TouchableOpacity testID="community-retry" accessibilityRole="button" style={s.loadMore} onPress={() => directory.refetch()}><Text style={s.cancelText}>{t('retry', 'Retry')}</Text></TouchableOpacity>}
      </View>}
      renderItem={({ item }) => {
        const failed=!!following.errors[item._id]&&following.values[item._id]===undefined;
        const busy = following.busy[item._id] || (!!following.owner && following.values[item._id] === undefined && !failed);
        const isFollowing = following.values[item._id] === true;
        const label = failed ? t('retry','Retry') : isFollowing ? t('unfollow', 'Unfollow') : t('follow', 'Follow');
        return <View style={s.row}>
          <TouchableOpacity testID={`community-user-${item._id}`} style={s.profile} accessibilityRole="button" accessibilityLabel={item.name} onPress={() => open(item)}>
            <View testID={`community-avatar-${item._id}`}><AvatarWithFallback uri={item.profileImageUrl || item.profilePhoto || item.avatar} size={32} /></View>
            <View style={s.info}><Text style={s.name} numberOfLines={1}>{item.name}</Text><Text style={s.count}>{item.favorites_count ?? item.favoriteStationsCount ?? 0} {t('radios', 'Radios')}</Text></View>
          </TouchableOpacity>
          {following.owner !== item._id && <TouchableOpacity testID={`community-follow-${item._id}`} accessibilityRole="button" accessibilityLabel={`${label}: ${item.name}`} accessibilityState={{ disabled: busy, selected: isFollowing }} disabled={busy} onPress={() => follow(item._id)} style={s.followTouch}>
            <View style={[s.pill, isFollowing && s.followingPill]}>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.followText}>{label}</Text>}</View>
          </TouchableOpacity>}
        </View>;
      }} />}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 78, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 21 },
  iconTouch: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, icon: { width: 24, height: 24 },
  list: { paddingHorizontal: 15, width: '100%', maxWidth: 630, alignSelf: 'center', flexGrow: 1 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333333', gap: 12 },
  profile: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 },
  info: { flex: 1, minWidth: 0 }, name: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 15 },
  count: { color: '#77787C', fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 15, marginTop: 3 },
  followTouch: { minWidth: 60, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  pill: { minHeight: 28, minWidth: 58, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#FF4199', alignItems: 'center', justifyContent: 'center' },
  followingPill: { backgroundColor: '#955572' },
  followText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 18 },
  searchHeader: { paddingHorizontal: 15, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchBox: { flex: 1, minWidth: 0, height: 45, borderRadius: 10, backgroundColor: '#F7F8FC', paddingLeft: 12, paddingRight: 6, gap: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, height: 43, borderWidth: 0, padding: 0, color: '#1B1C1E', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 17 },
  clearTouch: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelTouch: { minHeight: 44, justifyContent: 'center' }, cancelText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, emptyText: { textAlign: 'center', color: '#AAAAAA', fontFamily: 'Ubuntu-Regular', fontSize: 14, paddingVertical: 40 },
  footer: { paddingVertical: 20, alignItems: 'center' }, loadMore: { minHeight: 44, backgroundColor: '#333333', borderRadius: 22, paddingHorizontal: 22, justifyContent: 'center' },
});

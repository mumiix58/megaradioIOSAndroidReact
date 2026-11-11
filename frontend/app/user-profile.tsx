import { ProfilePhotoViewer } from '../src/components/ProfilePhotoViewer';
import {MegaLoadingState} from '../src/components/MegaLoadingState';
import { ProfileShareSheet } from '../src/components/ProfileShareSheet';
import { MegaLoadingIndicator as ActivityIndicator } from '../src/components/MegaLoadingIndicator';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../src/store/authStore';
import { useFavoritesStore } from '../src/store/favoritesStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useQuery} from '@tanstack/react-query';
import {previewConversations} from '../src/fixtures/chatPreview';
import {parseRadioGift} from '../src/utils/chatRadio';
import {ChatAvatar} from '../src/components/chat/ChatAvatar';
import {ProfileChatInvitation} from '../src/components/chat/ProfileChatInvitation';
import { StationVoteIcon } from '../src/components/StationVoteButton';
import { usePlayerStore } from '../src/store/playerStore';
import { getStationLogoUrl } from '../src/utils/stationLogoHelper';
import { useUserFavorites, useUserProfile } from '../src/hooks/useQueries';
import { getPreloadedFavorites } from '../src/services/preloadService';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { useDirectoryFollowing } from '../src/hooks/useDirectoryFollowing';
import { stationService } from '../src/services/stationService';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import { AvatarWithFallback } from '../src/components/AvatarWithFallback';
import { favoriteSubtitle, profileAvatar, profileCount, compactProfileVotes } from '../src/utils/publicProfileView';
import type { Station } from '../src/types';

const STATIONS_PER_PAGE = 29;
export default function UserProfileScreen() {
  const router = useRouter(); const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const params = useLocalSearchParams<{ userId: string; userName: string; userAvatar: string; userSlug: string; previewChat?: string; previewPhoto?: string }>();
  const userId = params.userId || '';
  const previewPerson=__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&params.previewChat==='1'?previewConversations.find(item=>item.partnerId===userId)?.partner:undefined;
  const [previewFollowing,setPreviewFollowing]=useState(true);
  const {data:previewStations=[],isLoading:previewStationsLoading}=useQuery({queryKey:['chat-preview-profile-stations',userId],enabled:!!previewPerson,queryFn:async()=>{let threads:any={};try{threads=JSON.parse(await AsyncStorage.getItem('megaradio-chat-sandbox-v2')||'{}');}catch{}const gifts=(Array.isArray(threads[userId])?threads[userId]:[]).map((message:any)=>parseRadioGift(message.content)).filter(Boolean);const unique=[...new Map(gifts.map((gift:any)=>[gift.stationId,gift])).values()] as NonNullable<ReturnType<typeof parseRadioGift>>[];return Promise.all(unique.slice(-8).map(async gift=>{try{return await stationService.getStation(gift.stationId)||{_id:gift.stationId,name:gift.name,country:gift.country,favicon:gift.logo,tags:gift.genre,url:''};}catch{return {_id:gift.stationId,name:gift.name,country:gift.country,favicon:gift.logo,tags:gift.genre,url:''};}}));}});
  const { user: currentUser, isAuthLoaded } = useAuthStore();
  const { favorites, toggleFavorite, loadFavorites, isLoaded: favoritesLoaded, isLoading: favoritesPending } = useFavoritesStore();
  const favoriteIds = useMemo(() => new Set(favorites.map(station => station._id)), [favorites]);
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({});
  useEffect(() => { if (isAuthLoaded && !favoritesLoaded && !favoritesPending) void loadFavorites(); }, [isAuthLoaded, favoritesLoaded, favoritesPending, loadFavorites]);
  const { playStation } = useAudioPlayer();
  const { currentStation, playbackState, isMiniPlayerVisible } = usePlayerStore();
  const isOwnProfile = (currentUser?._id || currentUser?.id) === userId;
  const { data: favoritesData, isLoading: favoritesLoading, isError: favoritesError, refetch: refetchFavorites } = useUserFavorites(previewPerson?'':userId);
  const { data: profileData, refetch: refetchProfile } = useUserProfile(previewPerson?'':userId);
  const profile = previewPerson || profileData?.user || profileData?.profile || profileData;
  const userName = profile?.name || profile?.fullName || params.userName || t('users', 'Users');
  const rawAvatar = profileAvatar(profile, params.userAvatar);
  const following = useDirectoryFollowing(userId ? [userId] : [], !isOwnProfile&&!previewPerson);
  const canChat = !isOwnProfile && (previewPerson ? previewFollowing : profile?.isPublicProfile === true && !!following.owner && following.values[userId] === true);
  const busy = !previewPerson&&(following.busy[userId] || (!!following.owner && following.values[userId] === undefined));
  const [showChatHint,setShowChatHint]=useState(false);
  const [chatPressed,setChatPressed]=useState(false);
  const chatHint=busy?t('chat_loading'):!previewPerson&&profile?.isPublicProfile===false?t('profile_chat_closed'):t('profile_chat_follow_hint');
  useEffect(()=>{if(!showChatHint)return;const timer=setTimeout(()=>setShowChatHint(false),3500);return()=>clearTimeout(timer);},[showChatHint]);
  const [visibleCount, setVisibleCount] = useState(STATIONS_PER_PAGE);
  const [showShareModal, setShowShareModal] = useState(false);
  const photoPreview = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && params.previewPhoto === '1';
  const [showPhoto, setShowPhoto] = useState(photoPreview);
  const closePhoto = useCallback(() => setShowPhoto(false), []);
  useFocusEffect(useCallback(() => () => setShowPhoto(false), []));
  useEffect(() => { setVisibleCount(STATIONS_PER_PAGE); setShowPhoto(photoPreview); setShowShareModal(false);setShowChatHint(false); }, [userId, photoPreview]);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'userDetail', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const allStations: Station[] = useMemo(() => {
    const raw = previewPerson?previewStations:Array.isArray(favoritesData) ? favoritesData : getPreloadedFavorites(userId) || [];
    const seen = new Set<string>();
    return raw.filter((station: Station) => { if (!station?._id || seen.has(station._id)) return false; seen.add(station._id); return true; });
  }, [favoritesData, userId, previewPerson, previewStations]);
  const followerCount = profileCount(profile?.followersCount ?? profile?.followers_count ?? profile?.followers);
  const followingCount=profileCount(profile?.followingCount??profile?.following_count??profile?.followsCount??profile?.following??profile?.follows);
  const handleFollowToggle = async () => {
    setShowChatHint(false);
    if(previewPerson){setPreviewFollowing(value=>!value);return;}
    if (!following.owner) { router.push({ pathname: '/auth-options', params: { returnTo: '/user-profile', returnParams: JSON.stringify({ ...params, userAvatar: rawAvatar || '' }) } }); return; }
    try { await following.toggle(userId); void refetchProfile(); }
    catch { Alert.alert(t('error', 'Error'), t('follow_error', 'İşlem tamamlanamadı. Tekrar deneyin.')); }
  };
  const handlePlayStation = async (station: Station) => {
    const full = station.url || station.urlResolved ? station : await stationService.getStation(station._id);
    if (full) await playStation(full, { kind: 'browse' });
  };
  const shareProfile = useMemo(() => ({ _id: userId, slug: params.userSlug, name: userName }), [userId, params.userSlug, userName]);

  const handleFavorite = async (station: Station) => {
    if (favoriteBusy[station._id]) return;
    setFavoriteBusy(value => ({ ...value, [station._id]: true }));
    try { await toggleFavorite(station); }
    catch { Alert.alert(t('error', 'Error'), t('favorites_load_error', 'Could not update favorites.')); }
    finally { setFavoriteBusy(value => ({ ...value, [station._id]: false })); }
  };
  const profileIntro = <View style={styles.favoritesHeading}><Text style={styles.favoritesTitle}>{t('profile_favorites', 'Favorites')}</Text><Text style={styles.favoritesDescription}>{t('public_profile_station_count', { count: allStations.length, defaultValue: '{{count}} favorite stations' })}</Text></View>;
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <View style={[styles.header,compact&&styles.compactHeader]} testID="user-profile-summary">
      <TouchableOpacity testID="user-profile-back-btn" style={[styles.iconTouch, styles.backTouch,compact&&styles.compactBackTouch]} accessibilityRole="button" accessibilityLabel={t('back', 'Back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/users')}><Image source={require('../assets/images/all-stations/back.svg')} style={styles.icon} contentFit="contain" /></TouchableOpacity>
      <TouchableOpacity testID="user-profile-avatar" onPress={() => setShowPhoto(true)} accessibilityRole="button" accessibilityLabel={userName} accessibilityHint={t('profile_photo', 'Profile photo')} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>{previewPerson?<ChatAvatar person={previewPerson} size={compact?36:40}/>:<AvatarWithFallback uri={rawAvatar} size={compact ? 36 : 40} figmaFallback />}</TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text testID="user-profile-name" style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">{userName}</Text>
        <View style={styles.followerLine}>
          <View style={styles.statGroup}><Text testID="profile-followers-count" style={[styles.statNumber,compact&&styles.compactStat]} numberOfLines={1}>{compactProfileVotes(followerCount)}</Text><Text style={[styles.statText,compact&&styles.compactStat]} numberOfLines={1}>{t('profile_followers_short', 'Followers')}</Text></View>
          <View style={styles.statDivider}/>
          <View style={styles.statGroup}><Text testID="profile-following-count" style={[styles.statNumber,compact&&styles.compactStat]} numberOfLines={1}>{compactProfileVotes(followingCount)}</Text><Text style={[styles.statText,compact&&styles.compactStat]} numberOfLines={1}>{t('profile_following_short')}</Text></View>
        </View>
      </View>
      {!isOwnProfile && <View style={styles.chatAnchor}><TouchableOpacity testID="user-profile-chat-btn" accessibilityRole="button" accessibilityLabel={t('chat_write')} accessibilityHint={canChat?t('chat_write'):chatHint} accessibilityState={{expanded:showChatHint,busy:!!busy}} style={styles.panelShare} activeOpacity={1} onPressIn={()=>setChatPressed(true)} onPressOut={()=>setChatPressed(false)} onPress={()=>{if(!canChat||busy){setShowChatHint(value=>!value);return;}setShowChatHint(false);router.push({pathname:'/messages',params:{userId,userName,userAvatar:rawAvatar||'',...(previewPerson?{previewChat:'1'}:{})}});}}><ProfileChatInvitation active={!!canChat&&!busy} paused={showChatHint||!!busy} pressed={chatPressed}/></TouchableOpacity>{showChatHint&&<View testID="profile-chat-follow-tooltip" accessibilityLiveRegion="polite" accessible accessibilityLabel={chatHint} style={styles.chatTooltip}><View style={styles.tooltipPointer}/><Text style={styles.tooltipText}>{chatHint}</Text></View>}</View>}

      {!isOwnProfile && <TouchableOpacity testID="user-profile-follow-btn" style={styles.followTouch} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} onPress={handleFollowToggle}><View style={styles.followPill}>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.followText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{(previewPerson?previewFollowing:following.values[userId]) ? t('unfollow', 'Unfollow') : t('follow', 'Follow')}</Text>}</View></TouchableOpacity>}
    </View>
    {(previewPerson ? previewStationsLoading : favoritesLoading) && !allStations.length ? <MegaLoadingState page variant="station-list" count={6}/> : <FlatList
      onScrollBeginDrag={()=>setShowChatHint(false)} testID="user-profile-stations" data={allStations.slice(0, visibleCount)} keyExtractor={item => item._id}
      contentContainerStyle={[styles.listContent, { paddingBottom: isMiniPlayerVisible && currentStation ? 100 : 24 }]} showsVerticalScrollIndicator={false}
      ListHeaderComponent={profileIntro}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{favoritesError ? t('error_loading_stations', 'Unable to load stations') : t('no_favorite_stations', 'No favorite stations yet')}</Text>{favoritesError && <TouchableOpacity onPress={() => refetchFavorites()} style={styles.followTouch}><Text style={styles.followText}>{t('retry', 'Retry')}</Text></TouchableOpacity>}</View>}
      ListFooterComponent={<View style={styles.profileFooter}>
        {allStations.length > visibleCount && <TouchableOpacity style={styles.seeMoreBtn} testID="see-more-stations-btn" accessibilityRole="button" onPress={() => setVisibleCount(count => count + STATIONS_PER_PAGE)}><Text style={styles.followText}>{t('load_more', 'Load More')}</Text></TouchableOpacity>}
        <TouchableOpacity testID="user-profile-share-btn" accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => setShowShareModal(true)}><Image source={require('../assets/images/player/share.svg')} style={styles.shareIcon}/><Text style={styles.statText}>{t('share_profile', 'Share profile')}</Text></TouchableOpacity>
      </View>}
      renderItem={({ item }) => {
        const active = currentStation?._id === item._id;
        const playing = active && playbackState === 'playing';
        const loading = active && ['loading', 'buffering'].includes(playbackState);
        return <View style={styles.stationCard}>
          <ImageWithFallback testID={`public-profile-station-logo-${item._id}`} uri={getStationLogoUrl(item)} style={styles.stationLogo} />
          <View style={styles.stationInfo}><Text style={styles.stationName} numberOfLines={1}>{item.name}</Text><Text style={styles.stationGenre} numberOfLines={1}>{favoriteSubtitle(item)}</Text>{typeof item.votes === 'number' && Number.isFinite(item.votes) && item.votes >= 0 && <View style={styles.voteRow}><StationVoteIcon size={13} color="#A7A7AC" /><Text style={styles.stationVotes} numberOfLines={1}>{compactProfileVotes(item.votes)}</Text></View>}</View>
          <View style={styles.stationActions}>
            <TouchableOpacity testID={`public-profile-favorite-${item._id}`} style={styles.favoriteTouch} accessibilityRole="button" accessibilityLabel={favoriteIds.has(item._id) ? t('remove_from_favorites', 'Remove from favorites') : t('add_to_favorites', 'Add to favorites')} accessibilityState={{ selected: favoriteIds.has(item._id), disabled: favoriteBusy[item._id] }} disabled={favoriteBusy[item._id]} onPress={() => handleFavorite(item)}>{favoriteBusy[item._id] ? <ActivityIndicator size="small" color="#FF4199" /> : <Image source={favoriteIds.has(item._id) ? require('../assets/images/mini-player/heart-filled.svg') : require('../assets/images/player/heart.svg')} style={styles.heartIcon} tintColor={favoriteIds.has(item._id) ? '#FF4199' : '#FFFFFF'} contentFit="contain" />}</TouchableOpacity>
          <TouchableOpacity testID={`play-station-${item._id}`} style={styles.playButton} accessibilityRole="button" accessibilityLabel={`${playing ? t('pause', 'Pause') : t('play', 'Play')} ${item.name}`} onPress={() => handlePlayStation(item)}>{loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Image source={playing ? require('../assets/images/mini-player/pause.svg') : require('../assets/images/mini-player/play.svg')} style={styles.icon} contentFit="contain" />}</TouchableOpacity>
          </View>
        </View>;
      }} />}
      <ProfilePhotoViewer visible={showPhoto} onClose={closePhoto} uri={rawAvatar} name={userName} person={previewPerson} />
      <ProfileShareSheet visible={showShareModal} onClose={() => setShowShareModal(false)} profile={shareProfile} preview={!!previewPerson} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  statGroup:{flexDirection:'row',alignItems:'center',gap:3,flexShrink:1,minWidth:0},statDivider:{width:1,height:12,backgroundColor:'#66666E',marginHorizontal:3},compactStat:{fontSize:10,lineHeight:14},chatAnchor:{position:'relative',width:44,height:44,flexShrink:0,marginLeft:6,marginRight:8,zIndex:10},chatTooltip:{position:'absolute',top:49,right:-46,width:202,paddingHorizontal:12,paddingVertical:9,borderRadius:6,backgroundColor:'#030507',zIndex:20},tooltipPointer:{position:'absolute',top:-8,right:61,width:0,height:0,borderLeftWidth:7,borderRightWidth:7,borderBottomWidth:8,borderLeftColor:'transparent',borderRightColor:'transparent',borderBottomColor:'#030507'},tooltipText:{fontFamily:'Ubuntu-Medium',fontSize:12,lineHeight:18,color:'#FFF'},
  container: { flex: 1, backgroundColor: '#1B1C1E' },
  compactHeader:{gap:4,paddingRight:8},compactBackTouch:{width:24},
  header: { zIndex:5,height: 80, width: '100%', maxWidth: 630, alignSelf: 'center', paddingLeft: 5, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, backTouch: { width: 32 }, panelShare: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, followerLine: { flexDirection: 'row', alignItems: 'center', gap: 4 }, favoritesHeading: { marginTop: 4, marginBottom: 18 }, favoritesTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 22, color: '#FFFFFF' }, favoritesDescription: { fontFamily: 'Ubuntu-Light', fontSize: 13, lineHeight: 17, color: '#AAAAAA', marginTop: 3 },
  iconTouch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, icon: { width: 24, height: 24 },
  headerInfo: { flex: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden', marginLeft: 4 }, headerName: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, marginBottom: 5 },
  statText: { flexShrink: 1, minWidth: 0, color: '#AAAAAA', fontFamily: 'Ubuntu-Light', fontSize: 12, lineHeight: 15 }, statNumber: { flexShrink: 0, color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 15 },
  followTouch: { minHeight: 44, minWidth: 64, maxWidth: 100, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  followPill: { backgroundColor: '#FF4199', minHeight: 28, maxWidth: 100, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, followText: { color: '#FFFFFF', fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 18 },
  listContent: { width: '100%', maxWidth: 630, alignSelf: 'center', paddingHorizontal: 15, paddingTop: 12 },
  stationCard: { height: 96, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#26272A', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  stationLogo: { width: 64, height: 64, borderRadius: 5 }, stationInfo: { flex: 1, minWidth: 0 },
  stationName: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, color: '#FFFFFF', marginBottom: 5 }, stationGenre: { fontFamily: 'Ubuntu-Light', fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }, stationVotes: { flexShrink: 1, fontFamily: 'Ubuntu-Regular', fontSize: 11, lineHeight: 15, color: '#A7A7AC' }, stationActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, favoriteTouch: { width: 40, height: 40,borderRadius:20,borderWidth:1.5,borderColor:'#000000',backgroundColor:'#26272A', alignItems: 'center', justifyContent: 'center' }, heartIcon: { width: 24, height: 24 },
  profileFooter: { alignItems: 'center', paddingVertical: 12, gap: 12 },
  shareIcon: { width: 20, height: 20 },
  playButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#303337', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', paddingVertical: 40 }, emptyText: { color: '#AAAAAA', fontFamily: 'Ubuntu-Regular', fontSize: 14 },
  seeMoreBtn: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: '#333333', justifyContent: 'center' },
});

import {MegaRefreshControl as RefreshControl} from '../src/components/MegaRefreshControl';
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,

  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatAvatar } from '../src/components/chat/ChatAvatar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../src/services/api';
import { API_ENDPOINTS } from '../src/constants/api';
import { useAuthStore } from '../src/store/authStore';
import stationService from '../src/services/stationService';
import { getStationLogoUrl } from '../src/utils/stationLogoHelper';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import { AvatarWithFallback } from '../src/components/AvatarWithFallback';
import { usePlayerStore } from '../src/store/playerStore';
import { notificationTime } from '../src/utils/notificationTime';
import { notificationTarget } from '../src/utils/notificationTarget';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { ProfilePhotoFeedback } from '../src/components/ProfilePhotoFeedback';
import type { Notification } from '../src/types/notifications';
import { notificationQueryOptions } from '../src/services/notificationQueries';
import {MegaLoadingState} from '../src/components/MegaLoadingState';

function NotificationArtwork({ item, loadDetails }: { item: Notification; loadDetails:boolean }) {
  const target=notificationTarget(item);
  const stationId=target?.kind==='station'?target.id:undefined;
  const suppliedLogo = getStationLogoUrl(item.station || item.data?.station) || getStationLogoUrl({ logo: item.data?.stationLogo });
  const { data: station } = useQuery({
    queryKey: ['notification-station', stationId],
    queryFn: () => stationService.getStation(stationId!),
    enabled: loadDetails && !!stationId && !suppliedLogo,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  if(item._id.startsWith('preview-notification-'))return <ChatAvatar person={typeof item.fromUserId==='object'?item.fromUserId as any:null} size={32}/>;
  if (stationId || item.type === 'new_station') {
    return <ImageWithFallback uri={suppliedLogo || getStationLogoUrl(station)}
      style={styles.avatar} contentFit="contain" />;
  }
  const sender = typeof item.fromUserId === 'object' ? item.fromUserId : item.fromUser;
  return <AvatarWithFallback size={32} uri={item.data?.userAvatar || (sender && 'profileImageUrl' in sender && typeof sender.profileImageUrl === 'string' ? sender.profileImageUrl : undefined) || sender?.avatar} />;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const params=useLocalSearchParams<{previewExamples?:string}>();
  const previewExamples=__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&params.previewExamples==='1';
  const [previewRead,setPreviewRead]=useState<string[]>([]);
  const insets = useSafeAreaInsets();
  const hasMiniPlayer = usePlayerStore(state => state.isMiniPlayerVisible && !!state.currentStation);
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'notifications', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const { isAuthenticated,user } = useAuthStore();
  const owner=user?._id||user?.id;
  const [refreshing, setRefreshing] = useState(false);
  const {playStation}=useAudioPlayer();
  const [opening,setOpening]=useState<string|null>(null);
  const [notice,setNotice]=useState<{error:boolean;message:string}|null>(null);
  const openingRef=useRef(false),active=useRef(true);
  useFocusEffect(useCallback(()=>{active.current=true;return()=>{active.current=false;};},[]));
  const dismissNotice=useCallback(()=>setNotice(null),[]);

  const listOptions=notificationQueryOptions(owner);
  const {data,isLoading,refetch}=useQuery({...listOptions,enabled:isAuthenticated&&!!owner});
  // fetchQuery reuses an in-flight request and the freshness window; refetch() would cancel/restart it.
  useFocusEffect(useCallback(()=>{if(isAuthenticated&&owner)void queryClient.prefetchQuery(notificationQueryOptions(owner));},[isAuthenticated,owner,queryClient]));
  const [visibleArtwork,setVisibleArtwork]=useState<Set<string>>(()=>new Set());
  const onViewableItemsChanged=useRef(({viewableItems}:{viewableItems:{item:Notification}[]})=>{
    const next=new Set(viewableItems.map(({item})=>item._id));
    setVisibleArtwork(old=>old.size===next.size&&[...next].every(id=>old.has(id))?old:next);
  }).current;

  const {data:previewRows=[]}=useQuery<Notification[]>({queryKey:['notification-design-examples',owner],enabled:previewExamples,
    queryFn:async()=>{let stored={};try{stored=JSON.parse(await AsyncStorage.getItem('megaradio-chat-sandbox-v2')||'{}');}catch{}
      return require('../src/fixtures/notificationPreview').createNotificationPreview(stored);},staleTime:30000});

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await api.patch(API_ENDPOINTS.user.markNotificationRead(notificationId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try{await refetch();}finally{setRefreshing(false);}
  }, [refetch]);

  const handleNotificationPress = async (notification: Notification) => {
    if(openingRef.current)return;
    const target=notificationTarget(notification);
    if(!target){setNotice({error:false,message:t('notification_target_unavailable','This item is no longer available.')});return;}
    openingRef.current=true;setOpening(notification._id);
    try {
      // A station target must be resolved before opening the shared current-station player.
      const station=target.kind==='station'?await queryClient.fetchQuery({queryKey:['notification-station',target.id],queryFn:()=>stationService.getStation(target.id),staleTime:30*60*1000,retry:false}):null;
      if(!active.current||(useAuthStore.getState().user?._id||useAuthStore.getState().user?.id)!==owner)return;
      if(target.kind==='station'&&!station){setNotice({error:false,message:t('notification_station_unavailable','This station cannot be opened right now.')});return;}
      if(notification._id.startsWith('preview-notification-'))setPreviewRead(rows=>[...rows,notification._id]);
      else if (!(notification.read ?? notification.isRead)) markAsReadMutation.mutate(notification._id);
      if(target.kind==='station'&&station){
        if(usePlayerStore.getState().currentStation?._id!==station._id)await playStation(station,{kind:'browse'});
        if(active.current&&(useAuthStore.getState().user?._id||useAuthStore.getState().user?.id)===owner)router.push('/player');
      }else router.push({pathname:target.kind==='chat'?'/messages':'/user-profile',params:{userId:target.id,userName:target.name||'',userAvatar:target.avatar||'',...(notification._id.startsWith('preview-notification-')?{previewChat:'1'}:{})}});
    }catch{if(active.current)setNotice({error:true,message:t('notification_open_failed','Unable to open this item. Please try again.')});}
    finally{openingRef.current=false;setOpening(null);}
  };

  const getNotificationText = (notification: Notification): { main: string; sub?: string } => {
    if (notification.type === 'follow') {
      const name = notification.data?.userName || (typeof notification.fromUserId === 'object' ? notification.fromUserId.fullName || notification.fromUserId.username : undefined) || notification.fromUser?.fullName || notification.fromUser?.username;
      return { main: name || t('users','User') };
    }

    if(notification.type==='new_message'){const target=notificationTarget(notification);return {main:target?.name||t('new_message','New message'),sub:notification.message};}
    if (notification.type === 'new_station') {
      const stationName = notification.data?.stationName || notification.station?.name;
      return {
        main: 'We added a new radio station!',
        sub: stationName
      };
    }

    // Fallback to message
    return { main: notification.message || notification.title || 'New notification' };
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const { main, sub } = getNotificationText(item);
    const unread=!(item.read??item.isRead);
    const message=item.type==='new_message',follow=item.type==='follow';
    const timeLabel=notificationTime(item.createdAt,i18n.language);

    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => void handleNotificationPress(item)}
        disabled={!!opening} accessibilityState={{busy:opening===item._id}}
        testID={`notification-item-${item._id}`}
        accessibilityRole="button"
      >
        {/* Avatar/Logo */}
        <View style={styles.artworkSlot}>
          <NotificationArtwork item={item} loadDetails={visibleArtwork.has(item._id)} />
          {(message||follow)&&<View style={[styles.activityBadge,message?styles.messageBadge:styles.followBadge]} accessible={false}>
            <Image source={message?require('../assets/images/chat/message.svg'):require('../assets/images/navigation/profile.svg')} style={styles.activityIcon} tintColor="#FFFFFF" contentFit="contain"/>
          </View>}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.notificationHeading}>
            <Text style={[styles.mainText,styles.headingText]} numberOfLines={2}>
              {main}{(message||follow)&&<Text style={styles.messageDescription}> {message?t('notification_message_received','sent you a message'):t('started_following_you','started following you')}</Text>}
            </Text>
            <View style={styles.metadata}>
              <Text style={styles.timeText}>{timeLabel}</Text>
              <View style={styles.unreadSlot}>{unread&&<View testID="notification-unread-dot" style={styles.unreadDot} accessibilityLabel={t('chat_filter_unread','Unread')}/>}</View>
            </View>
          </View>
          {!!sub&&<Text style={styles.subText} numberOfLines={message?1:2}>{sub}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const notifications=useMemo(()=>[...previewRows.map(row=>({...row,read:previewRead.includes(row._id)})),...(data?.notifications||[])],[previewRows,previewRead,data]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Image source={require('../assets/images/language/back.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('notifications')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{t('login')}</Text>
          <Text style={styles.emptyText}>{t('profile_login_required')}</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
            <Text style={styles.loginBtnText}>{t('login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header - matching Figma design */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          testID="notifications-back-btn" accessibilityRole="button" accessibilityLabel={t('back', 'Back')}
        >
          <Image source={require('../assets/images/language/back.svg')} style={{ width: 24, height: 24 }} contentFit="contain" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        <View style={styles.headerRight} />
      </View>


      {/* Content */}
      {isLoading && !notifications.length ? (
        <MegaLoadingState page variant="notifications" count={7} style={{paddingTop:0}}/>
      ) : (
        <FlatList
          data={notifications}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          onViewableItemsChanged={onViewableItemsChanged}
          extraData={visibleArtwork}
          renderItem={renderNotification}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom + (hasMiniPlayer ? 71 : 0) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF4081"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('no_notifications')}</Text>
              <Text style={styles.emptyText}>
                {t('notifications_empty_text') || "You'll see notifications about new followers and stations here."}
              </Text>
            </View>
          }
        />
      )}
      {notice&&<ProfilePhotoFeedback notice={notice} onDismiss={dismissNotice}/>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 78,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 21,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 0,
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 17.5,
    minHeight: 71,
    gap: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  artworkSlot:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  activityBadge:{position:'absolute',right:-1,bottom:-1,width:16,height:16,borderRadius:8,borderWidth:2,borderColor:'#1B1C1E',alignItems:'center',justifyContent:'center'},
  messageBadge:{backgroundColor:'#FF4199'},
  followBadge:{backgroundColor:'#45464D'},
  activityIcon:{width:9,height:9},
  notificationHeading:{flexDirection:'row',alignItems:'flex-start',gap:8},
  headingText:{flex:1,minWidth:0,marginBottom:0},
  metadata:{flexDirection:'row',alignItems:'center',gap:8,height:15,flexShrink:0},
  unreadSlot:{width:5,height:15,alignItems:'center',justifyContent:'center'},
  unreadDot:{width:5,height:5,borderRadius:2.5,backgroundColor:'#FF4199'},
  messageDescription:{fontFamily:'Ubuntu-Regular',color:'#A4A4AE'},
  mainText: {
    fontSize: 13,
    lineHeight: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  subText: {
    marginTop:5,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Ubuntu-Regular',
  },
  timeText: {
    fontSize: 11,
    color: '#A4A4AE',
    lineHeight: 15,
    fontFamily: 'Ubuntu-Regular',
  },
  separator: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginHorizontal: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    fontFamily: 'Ubuntu-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  loginBtnText: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
});

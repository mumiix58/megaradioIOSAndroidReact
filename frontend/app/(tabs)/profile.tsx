import {useAnalyticsOverlay} from '../../src/hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from '../../src/components/MegaLoadingIndicator';
import {useProfilePhotoCoach} from '../../src/hooks/useProfilePhotoCoach';
import {ProfilePhotoCoach} from '../../src/components/ProfilePhotoCoach';
import {ProfilePhotoFeedback} from '../../src/components/ProfilePhotoFeedback';
import {ProfilePhotoActions} from '../../src/components/ProfilePhotoActions';
import {profilePhotoFile} from '../../src/utils/profilePhoto';
import type {ContextMenuAnchor} from '../../src/components/chat/ChatContextMenu';
import {useQuery} from '@tanstack/react-query';
import {chatService} from '../../src/services/chatService';
import {groupChatService} from '../../src/services/groupChatService';
import {usePushPreferences} from '../../src/hooks/usePushPreferences';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
  Platform,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  useWindowDimensions} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { useLanguageStore } from '../../src/store/languageStore';
import { AvatarWithFallback } from '../../src/components/AvatarWithFallback';
// RewardedAdButton - platform-specific import (only on native)
const RewardedAdButton = Platform.OS !== 'web' 
  ? require('../../src/components/RewardedAdButton.native').RewardedAdButton
  : () => null;
import api from '../../src/services/api';
import userService from '../../src/services/userService';
import { PLAY_AT_LOGIN_KEY, DEFAULT_PLAY_AT_LOGIN, normalizePlayAtLogin } from '../../src/utils/playAtLogin';
import { ProfileShareSheet } from '../../src/components/ProfileShareSheet';
import API_ENDPOINTS from '../../src/constants/api';
import { ConnectionsScreen } from '../../src/components/ConnectionsScreen';
import type { ConnectionUser } from '../../src/utils/connections';
import { AccountSettingsScreen } from '../../src/components/AccountSettingsScreen';
import { LogoutModal } from '../../src/components/LogoutModal';
import { usePremiumStore } from '../../src/store/premiumStore';
import { PremiumPaywall } from '../../src/components/PremiumPaywall';
import { RateUsModal } from '../../src/components/RateUsModal';
import { rateUsService } from '../../src/services/rateUsService';

/**
 * Social proof counter — slowly grows over time so the number
 * feels alive without requiring a backend endpoint.
 * Base: 4,800 on 2026-01-01, +6 per day.
 */
const getLovedByCount = (): string => {
  const base = 4800;
  const startDate = new Date(2026, 0, 1).getTime();
  const daysSince = Math.max(0, Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24)));
  const count = base + daysSince * 6;
  return count.toLocaleString('en-US');
};
import appService, { AppInfo } from '../../src/services/appService';

// Language display names
function ProfileSwitch({ value, onValueChange, disabled = false, label }: { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return <TouchableOpacity accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} aria-checked={value} aria-disabled={disabled} disabled={disabled} onPress={event=>{event.stopPropagation();onValueChange(!value);}} style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
    <View style={{ width: 48, height: 26, borderRadius: 20, backgroundColor: value ? '#FF4199' : '#333333', padding: 2 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </View>
  </TouchableOpacity>;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
};

export default function ProfileScreen() {
  useFocusEffect(useCallback(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      const notify = (visible: boolean) => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'profile', visible }, 'http://localhost:8082');
      notify(true); return () => notify(false);
    }
  }, []));
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [profileFocused,setProfileFocused]=useState(false);
  useFocusEffect(useCallback(()=>{setProfileFocused(true);return()=>setProfileFocused(false);},[]));
  const messageOwner=user?._id||user?.id||'';
  const messageQueryEnabled=profileFocused&&isAuthenticated&&!!messageOwner;
  const unreadMessages=useQuery({queryKey:['chat-unread',messageOwner],queryFn:chatService.unread,enabled:messageQueryEnabled,staleTime:15000,refetchInterval:messageQueryEnabled?30000:false});
  const unreadGroups=useQuery({queryKey:['chat-groups',messageOwner],queryFn:groupChatService.list,enabled:messageQueryEnabled,staleTime:15000,refetchInterval:messageQueryEnabled?30000:false});
  const unreadMessageCount=(unreadMessages.data||0)+(unreadGroups.data||[]).reduce((sum,group)=>sum+(group.unreadCount||0),0);

  const { country, countryCode } = useLocationStore();
  const { currentLanguage, languageVersion } = useLanguageStore();
  // The tab dock already reserves the player, tab bar and bottom safe area.
  const bottomPadding=16;

  const previewParams = useLocalSearchParams<{ connections?: string; connectionsFrom?: string; previewConnections?: string; previewRemoveAds?: string; previewAccount?: string; previewAccountResult?: string; previewEditor?: string; previewDeleteAccount?: string; previewProfileShare?: string; previewLogout?: string; previewNotifications?:string; previewRateUs?:string; previewAvatarCoach?:string; previewAvatarFeedback?:string; previewAvatarLoading?:string }>();
  const [profileNotice,setProfileNotice]=useState<{error:boolean;message:string}|null>(null);
  const pushNotice=useCallback((error:boolean,key:string)=>setProfileNotice({error,message:t(key)}),[t]);
  const pushPreferences=usePushPreferences(user?._id||user?.id,isAuthenticated,pushNotice,__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&previewParams.previewNotifications==='1');
  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateProfileLoading, setPrivateProfileLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<'main' | 'account' | 'followers' | 'following'>('main');

  const [showRateUs, setShowRateUs] = useState(false);

  // Logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Delete Account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  useAnalyticsOverlay('delete-account',showDeleteModal);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Premium
  const [showPremiumPaywall, setShowPremiumPaywall] = useState(false);

  const connectionPreviewEnabled = __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && previewParams.previewConnections === '1';
  const [previewConnections, setPreviewConnections] = useState<{ ownerId: string; lists: Record<'followers' | 'following', ConnectionUser[]> } | null>(null);
  const connectionOwner = user?._id || user?.id;
  useEffect(() => {
    setPreviewConnections(connectionPreviewEnabled && connectionOwner ? { ownerId: connectionOwner, lists: require('../../src/fixtures/connections').createConnectionPreview() } : null);
  }, [connectionPreviewEnabled, connectionOwner]);
  const previewLists = previewConnections?.ownerId === connectionOwner ? previewConnections?.lists : undefined;
  useEffect(() => {
    if (previewParams.connections === 'followers' || previewParams.connections === 'following') setCurrentPage(previewParams.connections);
  }, [previewParams.connections]);
  const closeConnections = useCallback(() => {
    setCurrentPage('main');
    router.setParams({ connections: undefined, connectionsFrom: undefined });
    if (previewParams.connectionsFrom === 'statistics') {
      router.replace('/statistics');
    }
  }, [router, previewParams.connectionsFrom]);
  useEffect(() => { if (__DEV__ && Platform.OS === 'web' && previewParams.previewAccount === '1') setCurrentPage('account'); }, [previewParams.previewAccount]);
  useEffect(() => { if (__DEV__ && Platform.OS === 'web' && previewParams.previewDeleteAccount === '1') setShowDeleteModal(true); }, [previewParams.previewDeleteAccount]);
  useEffect(() => { if (__DEV__ && Platform.OS === 'web' && previewParams.previewLogout === '1') setShowLogoutModal(true); }, [previewParams.previewLogout]);
  useEffect(() => { if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1' && previewParams.previewRateUs==='1') setShowRateUs(true); },[previewParams.previewRateUs]);
  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1') {
      window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'deleteModal', visible: showDeleteModal }, 'http://localhost:8082');
      return () => window.parent.postMessage({ type: 'megaradio-preview-theme', screen: 'deleteModal', visible: false }, 'http://localhost:8082');
    }
  }, [showDeleteModal]);
  const closeDeleteModal = () => {
    if (deleteLoading) return;
    Keyboard.dismiss(); setShowDeleteModal(false); setDeleteConfirmText('');
  };
  const [showRemoveAdsPaywall, setShowRemoveAdsPaywall] = useState(__DEV__ && Platform.OS === 'web' && previewParams.previewRemoveAds === '1');
  const { isPremium, isRemoveAds, plan, loadPremiumStatus } = usePremiumStore();
  
  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const avatarRef=useRef<View>(null),profileRootRef=useRef<View>(null),avatarPickOwner=useRef<string|null>(null),pickAfterDismiss=useRef(false);
  const [avatarMenu,setAvatarMenu]=useState(false),[avatarMenuAnchor,setAvatarMenuAnchor]=useState<ContextMenuAnchor|null>(null),[avatarCoachAnchor,setAvatarCoachAnchor]=useState<ContextMenuAnchor|null>(null);
  const coachWindow=useWindowDimensions();
  const avatarCoach=useProfilePhotoCoach(messageOwner,profileFocused&&currentPage==='main'&&!!user&&!avatarUploading&&!avatarMenu&&!profileNotice,__DEV__&&Platform.OS==='web'&&previewParams.previewAvatarCoach==='1');
  const measureAvatar=useCallback(()=>{avatarRef.current?.measureInWindow((x,y,width,height)=>{if(width>0&&height>0)setAvatarCoachAnchor({x,y,width,height});});},[]);
  useEffect(()=>{if(avatarCoach.shown){const frame=requestAnimationFrame(measureAvatar);return()=>cancelAnimationFrame(frame);}},[avatarCoach.shown,coachWindow.width,coachWindow.height,measureAvatar]);

  const [showProfileShare, setShowProfileShare] = useState(false);
  const shareProfile = () => { if (user) setShowProfileShare(true); };
  useEffect(() => { if (__DEV__ && Platform.OS === 'web' && previewParams.previewProfileShare === '1') setShowProfileShare(true); }, [previewParams.previewProfileShare]);

  // App info from API
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  // Play at login setting
  const [playAtLoginSetting, setPlayAtLoginSetting] = useState<string>(DEFAULT_PLAY_AT_LOGIN);

  const userName = user?.name || user?.fullName || 'Guest';
  const userEmail = user?.email || 'guest@megaradio.com';
  
  // Debug log for avatar issue
  
  // Build full avatar URL if relative, with proper empty string check
  const rawAvatar = user?.profilePhoto || user?.avatar;
  const hasValidAvatar = rawAvatar && rawAvatar.trim().length > 0;
  let userAvatar: string | null = null;
  
  if (hasValidAvatar) {
    userAvatar = rawAvatar.startsWith('http') 
      ? rawAvatar 
      : `https://themegaradio.com${rawAvatar}`;
  }
  
  // Use real followers/following count from user data
  // Login response may not include these - fetch from API
  const [followersCount, setFollowersCount] = useState(user?.followersCount || 0);
  const [followsCount, setFollowsCount] = useState(user?.followingCount || 0);
  useEffect(() => {
    setLocalAvatar(null);setAvatarMenu(false);setProfileNotice(null);setAvatarUploading(false);avatarPickOwner.current=null;pickAfterDismiss.current=false;
    setPrivateProfileLoading(false);
    setPrivateProfile(user?.isPublicProfile === false);
    setFollowersCount(user?.followersCount || 0);
    setFollowsCount(user?.followingCount || 0);
  }, [user?._id, user?.id]);
  
  // Refresh profile data from API to get accurate follower/following counts
  useEffect(() => {
    let active = true;
    if (user?._id || user?.id) {
      const userId = user._id || user.id;
      api.get(`/api/user-profile/${userId}`)
        .then(res => {
          const data = res.data;
          if (data && active) {
            const fc = data.followersCount ?? data.followers ?? 0;
            const gc = data.followingCount ?? data.following ?? 0;
            setFollowersCount(typeof fc === 'number' ? fc : 0);
            setFollowsCount(typeof gc === 'number' ? gc : 0);
          }
        })
        .catch(e => console.log('[Profile] Could not refresh profile counts:', e?.message));
    }
    return () => { active = false; };
  }, [user?._id, user?.id]);

  // Sync private profile status from user data
  useEffect(() => {
    if (user) {
      // API returns isPublicProfile: true means profile is public
      // So privateProfile = !isPublicProfile
      setPrivateProfile(user.isPublicProfile === false);
    }
  }, [user]);

  // Fetch app info (social media links, etc.)
  useEffect(() => {
    appService.getAppInfo().then(info => {
      if (info) setAppInfo(info);
    });
  }, []);

  // Keep the summary current on return and across open web previews.
  useFocusEffect(useCallback(() => {
    let active = true;
    const refreshSetting = () => {
      void AsyncStorage.getItem(PLAY_AT_LOGIN_KEY).then(value => {
        if (active) setPlayAtLoginSetting(normalizePlayAtLogin(value));
      }).catch(() => {});
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAY_AT_LOGIN_KEY || event.key === null) refreshSetting();
    };
    refreshSetting();
    if (Platform.OS === 'web') window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      if (Platform.OS === 'web') window.removeEventListener('storage', onStorage);
    };
  }, []));

  // A success notice reflects the server result, never only the optimistic switch.
  const handlePrivateProfileToggle = async (value: boolean) => {
    if(!user||privateProfileLoading)return;
    const owner=user._id||user.id;
    const isCurrentOwner=()=>{const current=useAuthStore.getState().user;return (current?._id||current?.id)===owner;};
    setPrivateProfileLoading(true);
    const previousValue=privateProfile;
    setPrivateProfile(value);setProfileNotice(null);
    try{
      await api.put('/api/auth/profile',{isPublicProfile:!value});
      if(!isCurrentOwner())return;
      const {user:current,updateUser}=useAuthStore.getState();
      if(current&&updateUser)updateUser({...current,isPublicProfile:!value});
      setProfileNotice({error:false,message:t(value?'profile_now_private':'profile_now_public_short')});
    }catch(error){
      console.error('Failed to update profile privacy:',error);
      if(isCurrentOwner()){
        setPrivateProfile(previousValue);
        setProfileNotice({error:true,message:t('profile_privacy_update_failed')});
      }
    }finally{if(isCurrentOwner())setPrivateProfileLoading(false);}
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    
    // Call async logout which clears storage and resets favorites
    await logout();
    
    router.replace('/(tabs)');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') return;
    
    setDeleteLoading(true);
    try {
      await api.delete(API_ENDPOINTS.user.deleteAccount);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      await logout();
      router.replace('/(tabs)');
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('delete_account_error', 'Could not delete account. Please try again.');
      Alert.alert(t('error', 'Error'), msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const dismissProfileNotice=useCallback(()=>setProfileNotice(null),[]);
  useEffect(()=>{
    if(__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&previewParams.previewAvatarFeedback){
      const kind=previewParams.previewAvatarFeedback;
      const error=kind==='error'||kind==='privacy-error';
      const key=kind==='push-off'?'push_now_disabled_short':kind==='private'?'profile_now_private':kind==='public'?'profile_now_public_short':kind==='privacy-error'?'profile_privacy_update_failed':error?'avatar_upload_failed':'avatar_updated';
      setProfileNotice({error,message:t(key)});
    }
  },[previewParams.previewAvatarFeedback,t]);
  const avatarFeedback=(error:boolean,message:string)=>{
    setProfileNotice({error,message});

  };
  const handleAvatarUpload=()=>{
    if(avatarUploading||avatarPickOwner.current)return;avatarCoach.dismiss();setProfileNotice(null);
    if(hasValidAvatar||localAvatar){avatarRef.current?.measureInWindow((x,y,width,height)=>{if(width&&height){setAvatarMenuAnchor({x,y,width,height});setAvatarMenu(true);}});}
    else void pickAndUploadAvatar();
  };
  const pickAndUploadAvatar=async()=>{
    const owner=user?._id||user?.id;if(!owner||avatarPickOwner.current)return;
    avatarPickOwner.current=owner;setProfileNotice(null);
    const currentOwner=()=>{const current=useAuthStore.getState().user;return (current?._id||current?.id)===owner;};
    try{
      // Web file inputs must open in the user's click, without a native permission round trip.
      if(Platform.OS!=='web'){
        const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
        if(!permission.granted){if(currentOwner())avatarFeedback(true,t('photo_library_permission'));return;}
      }
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.8});
      if(result.canceled||!result.assets?.[0]||!currentOwner())return;
      const asset=result.assets[0],file=profilePhotoFile(asset);
      setAvatarUploading(true);setLocalAvatar(asset.uri);
      const formData=new FormData();
      if(Platform.OS==='web')formData.append('avatar',asset.file||await (await fetch(asset.uri)).blob(),file.name);
      else formData.append('avatar',{uri:asset.uri,name:file.name,type:file.type} as any);
      if(!currentOwner())return;
      const response=await userService.uploadAvatar(formData);
      if(response?.success!==true||typeof response.avatar!=='string'||!response.avatar)throw Error('avatar_upload_failed');
      const current=useAuthStore.getState().user;
      if(currentOwner()&&current){await useAuthStore.getState().updateUser({...current,avatar:response.avatar,profilePhoto:response.avatar});setLocalAvatar(null);avatarFeedback(false,t('avatar_updated'));}
    }catch(error:any){
      if(currentOwner()){setLocalAvatar(null);const key=['avatar_file_size','avatar_file_type'].includes(error?.message)?error.message:'avatar_upload_failed';avatarFeedback(true,t(key));}
    }finally{if(avatarPickOwner.current===owner){avatarPickOwner.current=null;if(currentOwner())setAvatarUploading(false);}}
  };
  const changeAvatar=()=>{
    setAvatarMenu(false);
    if(Platform.OS==='ios')pickAfterDismiss.current=true;
    else void pickAndUploadAvatar();
  };
  const handleAvatarDelete=async()=>{
    const owner=user?._id||user?.id;if(!owner||avatarUploading||avatarPickOwner.current)return;
    avatarPickOwner.current=owner;setAvatarUploading(true);
    try{
      const response=await userService.deleteAvatar();if(response?.success!==true)throw Error('Delete failed');
      const current=useAuthStore.getState().user;
      if(current&&(current._id||current.id)===owner){await useAuthStore.getState().updateUser({...current,avatar:null,profilePhoto:null});setLocalAvatar(null);setAvatarMenu(false);avatarFeedback(false,t('avatar_removed'));}
    }catch{const current=useAuthStore.getState().user;if((current?._id||current?.id)===owner){setAvatarMenu(false);avatarFeedback(true,t('avatar_delete_failed'));}}
    finally{if(avatarPickOwner.current===owner){avatarPickOwner.current=null;setAvatarUploading(false);}}
  };

  if (currentPage === 'followers' || currentPage === 'following') return <ConnectionsScreen key={`${connectionOwner}:${currentPage}`} kind={currentPage} onBack={closeConnections} previewRows={connectionPreviewEnabled ? previewLists?.[currentPage] || [] : undefined} onPreviewRemove={id => setPreviewConnections(previous => previous && ({ ...previous, lists: { ...previous.lists, [currentPage]: previous.lists[currentPage].filter(item => item._id !== id) } }))} onCountChange={currentPage === 'followers' ? setFollowersCount : setFollowsCount} />;

  if (currentPage === 'account') return <AccountSettingsScreen previewResult={__DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY === '1' && ['error','password'].includes(previewParams.previewAccountResult || '') ? previewParams.previewAccountResult as 'error' | 'password' : undefined} onBack={() => setCurrentPage('main')} initialEditor={__DEV__ && Platform.OS === 'web' && ['name', 'email', 'password'].includes(previewParams.previewEditor || '') ? previewParams.previewEditor as 'name' | 'email' | 'password' : null} />;

  // ── MAIN PROFILE ──
  // If not authenticated, show Guest User Settings
  if (!user) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
        >
          {/* Guest Header */}
          <View style={s.header}>
            <View style={s.avatarRow}>
              <View style={s.avatar}>
                <Ionicons name="person" size={48} color="#888" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{t('guest_user', 'Guest User')}</Text>
              </View>
            </View>
          </View>

          {/* Ad-Free Section */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('premium', 'Premium')}</Text>
            
            {/* Go Premium Button */}
            {!isPremium && (
              <TouchableOpacity
                style={[s.row, { backgroundColor: 'rgba(255,215,0,0.06)' }]}
                onPress={() => setShowPremiumPaywall(true)}
                data-testid="guest-go-premium-btn"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <Ionicons name="diamond" size={20} color="#FFD700" />
                  <View>
                    <Text style={[s.rowTitle, { color: '#FFD700' }]}>{t('go_premium', 'Go Premium')}</Text>
                    <Text style={{ fontSize: 12, color: '#999', fontFamily: 'Ubuntu-Regular' }}>
                      {t('unlock_features', 'Unlock all features')}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFD700" />
              </TouchableOpacity>
            )}
            <View style={s.divider} />
            
            {/* Remove Ads */}
            {!isRemoveAds && (
              <>
                <TouchableOpacity
                  style={s.row}
                  onPress={() => setShowRemoveAdsPaywall(true)}
                  data-testid="guest-remove-ads-btn"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                    <Ionicons name="ban-outline" size={20} color="#FF4199" />
                    <Text style={s.rowTitle}>{t('remove_ads', 'Remove Ads')}</Text>
                  </View>
                  <Text testID="profile-remove-ads-price" style={{fontSize:13,color:'#B9B9C1',fontFamily:'Ubuntu-Regular',marginRight:8}}>{t('from_price','€5.99/yr')}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
                <View style={s.divider} />
              </>
            )}
            
            {!isPremium && !isRemoveAds && <RewardedAdButton />}
          </View>

          {/* Settings Section */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('settings', 'Settings')}</Text>

            {/* Account - Redirects to Login */}
            <TouchableOpacity 
              style={s.row} 
              onPress={() => router.push('/auth-options')}
              data-testid="guest-account-btn"
            >
              <Ionicons name="person-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('account', 'Account')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            {/* Language Picker */}
            <TouchableOpacity 
              style={s.row}
              onPress={() => router.push('/languages')}
              data-testid="guest-language-btn"
            >
              <Ionicons name="language-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('language', 'Language')}</Text>
              <View style={s.rowRight}>
                <Text style={s.rowVal}>{LANGUAGE_NAMES[currentLanguage] || 'English'}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>

            {/* Country Picker */}
            <TouchableOpacity 
              style={s.row} 
              onPress={() => router.push('/station-country')}
              data-testid="guest-country-btn"
            >
              <Ionicons name="location-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('country', 'Country')}</Text>
              <View style={s.rowRight}>
                <Text style={s.rowVal}>{country || 'Not set'}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>

            {/* Private Profile - Login Required */}
            <TouchableOpacity 
              style={s.row} 
              onPress={() => router.push('/auth-options')}
              data-testid="guest-private-profile-btn"
            >
              <Ionicons name="lock-closed-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('private_profile', 'Private Profile')}</Text>
              <View style={s.rowRight}>
                <Text style={[s.rowVal, { color: '#888' }]}>{t('login_required', 'Login Required')}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </View>
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('about', 'About')}</Text>

            <TouchableOpacity
              style={s.row}
              onPress={() => setShowRateUs(true)}
              data-testid="profile-rate-us-btn"
            >
              <Ionicons name="star-outline" size={22} color="#FFF" style={s.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowText}>{t('rate_us', 'Rate Us')}</Text>
                <Text style={s.rowSubtext}>{t('rate_us_sub', { defaultValue: 'Loved by {{count}}+ users', count: Number(getLovedByCount().replace(/,/g, '')) })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'about' } } as any)}>
              <Ionicons name="information-circle-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('about_us', 'About Us')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'terms' } } as any)}>
              <Ionicons name="document-text-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('terms', 'Terms of Service')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'privacy' } } as any)}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#FFF" style={s.rowIcon} />
              <Text style={s.rowText}>{t('privacy', 'Privacy Policy')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <View style={s.section}>
            <TouchableOpacity 
              style={s.loginBtn} 
              onPress={() => router.push('/auth-options')}
              data-testid="guest-login-btn"
            >
              <Text style={s.loginBtnText}>{t('sign_in_sign_up', 'Sign In / Sign Up')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Premium Paywall (guest) */}
        <PremiumPaywall
          visible={showPremiumPaywall}
          onClose={() => setShowPremiumPaywall(false)}
          mode="premium"
        />
        
        {/* Remove Ads Paywall (guest) */}
        <PremiumPaywall
          visible={showRemoveAdsPaywall}
          onClose={() => setShowRemoveAdsPaywall(false)}
          mode="remove_ads"
        />

        {/* Rate Us Modal (guest) */}
        <RateUsModal
          visible={showRateUs}
          onClose={() => {
            setShowRateUs(false);
            if(!(__DEV__&&Platform.OS==='web'&&previewParams.previewRateUs==='1'))rateUsService.markDismissed().catch(() => {});
          }}
          onRated={() => {
            rateUsService.markRated().catch(() => {});
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView ref={profileRootRef} onLayout={measureAvatar} style={p.container} edges={['top']}>
        {/* Header */}
        <View style={p.header}>
          <View style={p.avatarRow}>
            <TouchableOpacity
              ref={avatarRef} onLayout={measureAvatar} hitSlop={6}
              style={p.avatar}
              accessibilityRole="button" accessibilityLabel={t('avatar', 'Profile Photo')}
              onPress={handleAvatarUpload}
              disabled={avatarUploading}
              testID="profile-avatar-btn"
            >
              {localAvatar ? (
                <Image
                  source={{ uri: localAvatar }}
                  style={p.avatarImage}
                  onError={() => console.log('[Profile Avatar] Local preview failed to load')}
                />
              ) : (
                <AvatarWithFallback
                  uri={rawAvatar}
                  size={40}
                />
              )}
              {(avatarUploading||(__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'&&previewParams.previewAvatarLoading==='1'))&&<View testID="profile-avatar-loading" pointerEvents="none" style={p.avatarLoading}><ActivityIndicator size={20} color="#FFFFFF" style={{width:20,height:20}}/></View>}
              {/* Camera badge */}
              <View style={p.cameraBadge}>
                <Image source={require('../../assets/images/profile/edit.svg')} style={{ width: 14, height: 14 }} contentFit="contain" />
              </View>
            </TouchableOpacity>
            <View style={p.identity}>
              <Text style={p.userName} numberOfLines={1}>{userName}</Text>
              <View style={p.statsRow}>
                <TouchableOpacity
                  style={p.statTouchable} hitSlop={{ top: 15, bottom: 15, left: 0, right: 0 }}
                  accessibilityRole="button" accessibilityLabel={t('followers', 'Followers')} onPress={() => setCurrentPage('followers')}
                  testID="profile-followers-btn"
                >
                  <View style={p.statPair}><Text style={p.statLabel}>{t('followers', 'Followers')}</Text><Text style={p.statNumber}>{previewLists ? previewLists.followers.length : followersCount}</Text></View>
                </TouchableOpacity>
                <View style={p.statDivider} />
                <TouchableOpacity
                  style={p.statTouchable} hitSlop={{ top: 15, bottom: 15, left: 0, right: 0 }}
                  accessibilityRole="button" accessibilityLabel={t('follows', 'Follows')} onPress={() => setCurrentPage('following')}
                  testID="profile-follows-btn"
                >
                  <View style={p.statPair}><Text style={p.statLabel}>{t('follows', 'Follows')}</Text><Text style={p.statNumber}>{previewLists ? previewLists.following.length : followsCount}</Text></View>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity testID="profile-share-button" accessibilityRole="button" onPress={shareProfile}
              accessibilityLabel={t('share_profile', 'Share profile')} style={p.shareButton}>
              <Image source={require('../../assets/images/player/share.svg')} style={{ width: 24, height: 24 }} contentFit="contain" accessible={false} />
            </TouchableOpacity>
          </View>
        </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        testID="profile-scroll-content"
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >

        <View style={{ marginBottom: isPremium ? 0 : 12 }}>
          {/* Go Premium Button */}
          {!isPremium && (
            <TouchableOpacity style={p.premiumBanner} onPress={() => setShowPremiumPaywall(true)} accessibilityRole="button" accessibilityLabel={t('go_premium', 'Go Premium')} testID="go-premium-btn">
              <LinearGradient colors={['#5C27F4', '#9F3FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={p.premiumGradient}>
                <View style={p.crownBox}><FontAwesome5 name="crown" size={30} color="#FFD146" /></View>
                <View style={{ flex: 1 }}><Text style={p.premiumTitle}>{t('go_premium', 'Go Premium')}</Text><Text style={p.premiumSubtitle}>{t('home_premium_subtitle', 'Unlock amazing features')}</Text></View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings */}
        <Text style={p.sectionLabel}>{t('settings', 'Settings')}</Text>
        {[
          {
            title: t('play_at_login', 'Play at Login'),
            sub: playAtLoginSetting === 'last_played' ? t('last_played', 'Last Played')
               : playAtLoginSetting === 'random' ? t('random', 'Random')
               : playAtLoginSetting === 'favorite' ? t('favorite', 'Favorite')
               : t('off', 'Off'),
            onPress: () => router.push('/play-at-login')
          },
          { title: t('chat_messages'), messages: true, onPress: () => router.push('/messages') },
          { countryFlag: true, title: t('country', 'Country'), sub: country || t('not_set', 'Not set'), onPress: () => router.push('/station-country') },
          { title: t('language', 'Language'), sub: LANGUAGE_NAMES[currentLanguage] || currentLanguage, onPress: () => router.push('/languages' as any) },
          { title: t('statistics', 'Statistics'), onPress: () => router.push('/statistics') },
          { title: t('account', 'Account'), onPress: () => setCurrentPage('account') },
        ].map((item, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity style={p.row} onPress={item.onPress} accessibilityRole="button" accessibilityLabel={item.title} testID={item.messages?'profile-messages':`profile-setting-${i}`} >
              <View>
                <Text style={p.rowTitle}>{item.title}</Text>
                {item.sub && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  {item.countryFlag && countryCode && <Image source={{ uri: `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png` }} style={{ width: 16, height: 11, borderRadius: 2 }} contentFit="cover" />}
                  <Text style={[p.rowSub, { marginTop: 0 }]}>{item.sub}</Text>
                </View>}
              </View>
              <View style={{flexDirection:'row',alignItems:'center',gap:12}}>{item.messages&&unreadMessageCount>0&&<View testID="profile-messages-unread" style={{minWidth:22,height:22,paddingHorizontal:6,borderRadius:11,backgroundColor:'#FF4199',alignItems:'center',justifyContent:'center'}}><Text style={{fontFamily:'Ubuntu-Bold',fontSize:11,color:'#FFF'}}>{unreadMessageCount>99?'99+':unreadMessageCount}</Text></View>}<Image source={require('../../assets/images/profile/arrow-left.svg')} style={{ width: 24, height: 24, transform: [{ rotate: '180deg' }] }} tintColor="#FFFFFF" contentFit="contain" /></View>
            </TouchableOpacity>
            <View style={p.dividerBackground}><View style={p.divider} /></View>
          </React.Fragment>
        ))}

        <Pressable testID="profile-notification-row" accessible={false} style={p.row} disabled={pushPreferences.saving||!pushPreferences.ready} onPress={()=>void pushPreferences.toggle(!pushPreferences.enabled)}>
          <View style={{flex:1,paddingRight:12}}><Text style={p.rowTitle}>{t('notifications_setting','Notifications')}</Text>{pushPreferences.needsSettings&&<TouchableOpacity testID="push-system-settings" accessibilityRole="button" onPress={event=>{event.stopPropagation();if(pushPreferences.canRequestPermission)void pushPreferences.toggle(true);else if(Platform.OS!=='web')void Linking.openSettings().catch(()=>pushNotice(true,'push_permission_required'));}} style={{minHeight:32,justifyContent:'center'}}><Text style={{color:'#FF4199',fontFamily:'Ubuntu-Medium',fontSize:12}}>{t(pushPreferences.canRequestPermission?'push_allow_permission':'push_open_settings')}</Text></TouchableOpacity>}</View>
          <ProfileSwitch value={pushPreferences.enabled} disabled={pushPreferences.saving || !pushPreferences.ready} onValueChange={pushPreferences.toggle} label={t('notifications_setting', 'Notifications')} />
        </Pressable>
        <View style={p.dividerBackground}><View style={p.divider} /></View>
        <View style={p.row}>
          <Text style={p.rowTitle}>{t('private_profile', 'Private Profile')}</Text>
          <ProfileSwitch value={privateProfile} onValueChange={handlePrivateProfileToggle} disabled={privateProfileLoading} label={t('private_profile', 'Private Profile')} />
        </View>

        {/* Subscription settings */}
        <View style={p.section}>

          {isPremium && (
            <View style={[p.row, { backgroundColor: 'rgba(255,215,0,0.06)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Ionicons name="diamond" size={20} color="#FFD700" />
                <Text style={[p.rowTitle, { color: '#FFD700' }]}>Premium Active</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
          )}
          <View style={p.dividerBackground}><View style={p.divider} /></View>

          {/* Remove Ads (only for non-premium, non-removeAds users) */}
          {!isRemoveAds && (
            <>
              <TouchableOpacity
                style={p.row}
                onPress={() => setShowRemoveAdsPaywall(true)}
                testID="remove-ads-btn"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <Ionicons name="ban-outline" size={20} color="#FF4199" />
                  <Text style={p.rowTitle}>{t('remove_ads', 'Remove Ads')}</Text>
                </View>
                <Text testID="profile-remove-ads-price" style={{fontSize:13,color:'#B9B9C1',fontFamily:'Ubuntu-Regular',marginRight:8}}>{t('from_price','€5.99/yr')}</Text>
                <Image source={require('../../assets/images/profile/arrow-left.svg')} style={{ width: 24, height: 24, transform: [{ rotate: '180deg' }] }} tintColor="#FFFFFF" contentFit="contain" />
              </TouchableOpacity>
              <View style={p.dividerBackground}><View style={p.divider} /></View>
            </>
          )}

          {/* Rewarded Ad - Watch Ad for 30 min free (hidden for premium/ad-free users) */}
          {!isPremium && !isRemoveAds && (
            <>
              <RewardedAdButton />
              <View style={p.dividerBackground}><View style={p.divider} /></View>
            </>
          )}


        </View>

        {/* About */}
        <Text style={p.sectionLabel}>{t('about', 'About')}</Text>
        <TouchableOpacity style={p.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'about' } } as any)}>
          <Text style={p.rowTitle}>{t('about_us', 'About Us')}</Text>
          <Image source={require('../../assets/images/profile/arrow-left.svg')} style={{ width: 24, height: 24, transform: [{ rotate: '180deg' }] }} tintColor="#FFFFFF" contentFit="contain" />
        </TouchableOpacity>
        <View style={p.dividerBackground}><View style={p.divider} /></View>
        <TouchableOpacity style={p.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'privacy' } } as any)}>
          <Text style={p.rowTitle}>{t('privacy_policy', 'Privacy Policy')}</Text>
          <Image source={require('../../assets/images/profile/arrow-left.svg')} style={{ width: 24, height: 24, transform: [{ rotate: '180deg' }] }} tintColor="#FFFFFF" contentFit="contain" />
        </TouchableOpacity>
        <View style={p.dividerBackground}><View style={p.divider} /></View>
        <TouchableOpacity style={p.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'terms' } } as any)}>
          <Text style={p.rowTitle}>{t('terms_conditions', 'Terms and Conditions')}</Text>
          <Image source={require('../../assets/images/profile/arrow-left.svg')} style={{ width: 24, height: 24, transform: [{ rotate: '180deg' }] }} tintColor="#FFFFFF" contentFit="contain" />
        </TouchableOpacity>

        <TouchableOpacity
          style={p.rateCard}
          onPress={() => setShowRateUs(true)}
          testID="profile-rate-us-btn-guest"
        >
          <Text style={p.rateEmoji}>😍</Text>
          <View style={{ alignItems: 'center' }}>
            <Text style={p.rowTitle}>{t('rate_us', 'Rate Us')}</Text>
            <Text style={p.rowSubtext}>{t('rate_us_sub', { defaultValue: 'Loved by {{count}}+ users', count: Number(getLovedByCount().replace(/,/g, '')) })}</Text>
          </View>
        </TouchableOpacity>

        {/* Social */}
        <Text style={[p.sectionLabel, { textAlign: 'center', backgroundColor: 'transparent' }]}>{t('social_media', 'Social Media')}</Text>
        <View style={p.socialRow}>
          {[
            { name: 'facebook-f' as const, image: require('../../assets/images/profile/facebook.svg'), url: appInfo?.social?.facebook },
            { name: 'instagram' as const, image: require('../../assets/images/profile/instagram.svg'), url: appInfo?.social?.instagram },
            { name: 'twitter' as const, image: require('../../assets/images/profile/twitter.svg'), url: appInfo?.social?.twitter },
          ].map((soc) => (
            <TouchableOpacity
              key={soc.name}
              style={p.socialBtn}
              onPress={() => soc.url && Linking.openURL(soc.url)}
            >
              <Image source={soc.image} style={{ width: 48, height: 48 }} contentFit="contain" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={p.logoutBtn} accessibilityRole="button" onPress={() => setShowLogoutModal(true)} testID="profile-logout-btn">
          <Text style={p.logoutText}>{t('log_out', 'Log Out')}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={s.deleteAccountBtn}
          onPress={() => setShowDeleteModal(true)}
          testID="delete-account-btn"
        >
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          <Text style={s.deleteAccountText}>{t('delete_account', 'Delete Account')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {profileNotice&&<ProfilePhotoFeedback notice={profileNotice} onDismiss={dismissProfileNotice}/>}
      {avatarCoach.shown&&avatarCoachAnchor&&<ProfilePhotoCoach anchor={avatarCoachAnchor} privateProfile={privateProfile} hasPhoto={!!hasValidAvatar} avatarUri={localAvatar||rawAvatar} onUpload={()=>{avatarCoach.dismiss();void pickAndUploadAvatar();}} onClose={avatarCoach.dismiss}/>}
      <ProfilePhotoActions visible={avatarMenu} anchor={avatarMenuAnchor} busy={avatarUploading} onClose={()=>{if(!avatarUploading)setAvatarMenu(false);}} onChange={changeAvatar} onRemove={handleAvatarDelete} onDismiss={()=>{if(pickAfterDismiss.current){pickAfterDismiss.current=false;void pickAndUploadAvatar();}}}/>
      <ProfileShareSheet visible={showProfileShare} onClose={() => setShowProfileShare(false)} />

      {/* Logout Modal */}
      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={closeDeleteModal} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView style={s.deleteOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.deleteModalContent} keyboardShouldPersistTaps="handled" bounces={false}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDeleteModal} disabled={deleteLoading} accessible={false} testID="delete-modal-backdrop" />
          <View style={s.deleteContainer} accessibilityViewIsModal>
            <View style={s.deleteHeading}><Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={s.deleteTitle}>{t('delete_account_title', 'Delete Account')}</Text></View>
            <Text style={s.deleteDesc}>
              {t('delete_account_warning', 'This action is permanent and cannot be undone. All your data, favorites, listening history, and active subscriptions will be lost.')}
            </Text>
            <Text style={s.deleteConfirmLabel}>
              {t('type_delete_confirm', 'Type "delete" to confirm:')}
            </Text>
            <TextInput
              style={s.deleteInput}
              placeholder="delete"
              placeholderTextColor="#555"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="none"
              testID="delete-confirm-input"
              accessibilityLabel={t('type_delete_confirm', 'Type "delete" to confirm:')}
              autoCorrect={false}
              editable={!deleteLoading}
              keyboardAppearance="dark"
            />
            <View style={s.deleteButtonRow}>
              <TouchableOpacity 
                style={s.deleteCancelBtn} 
                onPress={closeDeleteModal}
                disabled={deleteLoading}
                accessibilityRole="button"
                testID="delete-cancel-btn"
              >
                <Text style={s.deleteCancelText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.deleteConfirmBtn, deleteConfirmText.toLowerCase() !== 'delete' && { opacity: 0.4 }]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleteLoading}
                testID="delete-confirm-btn"
                accessibilityRole="button"
                accessibilityState={{ disabled: deleteConfirmText.toLowerCase() !== 'delete' || deleteLoading }}
              >
                <View style={s.deleteDangerPill}>{deleteLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={s.deleteConfirmText}>{t('delete_permanently', 'Delete Permanently')}</Text>
                )}</View>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPremiumPaywall}
        onClose={() => setShowPremiumPaywall(false)}
        mode="premium"
      />

      {/* Remove Ads Paywall */}
      <PremiumPaywall
        visible={showRemoveAdsPaywall}
        onClose={() => setShowRemoveAdsPaywall(false)}
        mode="remove_ads"
      />

      {/* Rate Us Modal */}
      <RateUsModal
        visible={showRateUs}
        onClose={() => {
          setShowRateUs(false);
          rateUsService.markDismissed().catch(() => {});
        }}
        onRated={() => {
          rateUsService.markRated().catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  shareButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0D0D0F' },
  // Header
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' as const },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute' as const, bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF4199', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0D0D0F' },
  name: { fontSize: 20, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  userName: { fontSize: 20, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  statsRow: { flexDirection: 'row', marginTop: 4, alignItems: 'center' },
  statTouchable: { alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  statNumber: { fontSize: 16, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  statLabel: { fontSize: 13, fontFamily: 'Ubuntu-Regular', color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#333', marginHorizontal: 8 },
  // Section
  section: { marginBottom: 8 },
  sectionLabel: { fontSize: 18, fontFamily: 'Ubuntu-Bold', color: '#FFF', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  // Rows
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1A1A1C', marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
  rowIcon: { marginRight: 12 },
  rowText: { flex: 1, fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  rowSubtext: { fontSize: 12, fontFamily: 'Ubuntu-Regular', color: '#FF4199', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowVal: { fontSize: 14, fontFamily: 'Ubuntu-Regular', color: '#888' },
  rowTitle: { fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  rowSub: { fontSize: 13, fontFamily: 'Ubuntu-Regular', color: '#888', marginTop: 2 },
  divider: { height: 0.5, backgroundColor: '#2A2A2A', marginHorizontal: 16 },
  // Social
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 20 },
  socialBtn: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  // Logout
  logoutBtn: { alignSelf: 'center', paddingHorizontal: 40, paddingVertical: 12, borderRadius: 20, backgroundColor: '#333', marginTop: 8 },
  logoutText: { fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  // Sub pages header
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  subTitle: { fontSize: 18, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  // Account
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  aLabel: { fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  aValue: { fontSize: 14, fontFamily: 'Ubuntu-Regular', color: '#888', marginTop: 2 },
  // Country picker
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 16, height: 48 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Ubuntu-Regular', color: '#000' },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#1A1A1C', marginHorizontal: 12, marginBottom: 6, borderRadius: 12, gap: 12 },
  countryRowActive: { borderWidth: 1, borderColor: '#FF4199' },
  flagEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  flagImage: { width: 36, height: 24, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  countryName: { fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  countryNative: { fontSize: 13, fontFamily: 'Ubuntu-Regular', color: '#888', marginTop: 2 },
  stationCount: { fontSize: 13, fontFamily: 'Ubuntu-Regular', color: '#888', marginRight: 12 },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FF4199', justifyContent: 'center', alignItems: 'center' },
  radioCircleActive: { borderColor: '#FF4199' },
  radioCircleFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF4199' },
  // Modals
  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  mBox: { width: '100%', backgroundColor: '#1B1C1E', borderRadius: 16, padding: 24, alignItems: 'center' },
  mTitle: { fontSize: 18, fontFamily: 'Ubuntu-Bold', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  mSub: { fontSize: 14, fontFamily: 'Ubuntu-Regular', color: '#888', textAlign: 'center', marginTop: 4 },
  mInputRow: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 16, height: 48, marginBottom: 16 },
  mInput: { flex: 1, fontSize: 16, fontFamily: 'Ubuntu-Regular', color: '#000' },
  mActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 16 },
  mCancel: { fontSize: 16, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  mPinkBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FF4199' },
  mPinkText: { fontSize: 16, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
  checkCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FF4199', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  pwRow: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: 16, height: 48, marginBottom: 12 },
  pwInput: { flex: 1, fontSize: 16, fontFamily: 'Ubuntu-Regular', color: '#FFF' },
  // Guest state
  guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  guestAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A1D', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  guestTitle: { fontSize: 24, fontFamily: 'Ubuntu-Bold', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  guestSubtitle: { fontSize: 15, fontFamily: 'Ubuntu-Regular', color: '#888', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  loginBtn: { marginHorizontal: 16, height: 56, borderRadius: 28, backgroundColor: '#FF4B8C', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  loginBtnText: { fontSize: 17, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  skipBtn: { width: '100%', height: 56, borderRadius: 28, borderWidth: 1, borderColor: '#3A3A3D', justifyContent: 'center', alignItems: 'center' },
  skipBtnText: { fontSize: 17, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  // Delete Account
  deleteAccountBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 20, paddingHorizontal: 20, paddingVertical: 10 },
  deleteAccountText: { fontSize: 14, fontFamily: 'Ubuntu-Regular', color: '#FF3B30' },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  deleteModalContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  deleteContainer: { width: 302, maxWidth: '100%', backgroundColor: '#000000', borderRadius: 6, borderWidth: 1, borderColor: '#292929', paddingHorizontal: 18, paddingTop: 28, paddingBottom: 24 },
  deleteHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  deleteTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
  deleteDesc: { fontSize: 13, fontFamily: 'Ubuntu-Regular', color: '#AAAAAA', lineHeight: 19, marginBottom: 22 },
  deleteConfirmLabel: { fontSize: 13, lineHeight: 18, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', marginBottom: 11 },
  deleteInput: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 0, height: 45, fontSize: 15, fontFamily: 'Ubuntu-Medium', color: '#5B5B5B', marginBottom: 24, outlineWidth: 0, outlineStyle: 'solid' },
  deleteButtonRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  deleteCancelBtn: { minWidth: 68, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteCancelText: { fontSize: 13, lineHeight: 16, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF' },
  deleteConfirmBtn: { flexShrink: 1, minHeight: 44, justifyContent: 'center' },
  deleteDangerPill: { minHeight: 30, borderRadius: 10, backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { fontSize: 13, lineHeight: 16, fontFamily: 'Ubuntu-Medium', color: '#FFFFFF', textAlign: 'center' },
});


// Final Figma profile-logged-in / 1:5890. Existing extra actions use the same row system.
const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1C1E' },
  header: { height: 86, paddingHorizontal: 15, paddingTop: 24, paddingBottom: 22, backgroundColor: '#1B1C1E' },
  avatarRow: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { flex: 1, minWidth: 0, alignSelf: 'flex-end' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333333', position: 'relative' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarLoading: { position:'absolute',inset:0,width:40,height:40,borderRadius:20,backgroundColor:'#00000080',alignItems:'center',justifyContent:'center' },
  cameraBadge: { position: 'absolute', top: 30, left: 28, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  userName: { fontFamily: 'Ubuntu-Bold', fontSize: 15, lineHeight: 17, color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  statPair: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTouchable: { height: 14, justifyContent: 'center' },
  statLabel: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 14, color: '#9C9C9C' },
  statNumber: { fontFamily: 'Ubuntu-Medium', fontSize: 12, lineHeight: 14, color: '#FFFFFF' },
  statDivider: { display: 'none' },
  shareButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontFamily: 'Ubuntu-Medium', fontSize: 18, lineHeight: 21, color: '#FFFFFF', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 20, backgroundColor: '#1B1C1E' },
  section: { marginBottom: 0 },
  row: { minHeight: 84, paddingHorizontal: 25, paddingVertical: 20, backgroundColor: '#262626', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontFamily: 'Ubuntu-Medium', fontSize: 15, lineHeight: 18, color: '#FFFFFF' },
  rowSub: { fontFamily: 'Ubuntu-Regular', fontSize: 13, lineHeight: 16, color: '#A6A6AA', marginTop: 8 },
  rowSubtext: { fontFamily: 'Ubuntu-Regular', fontSize: 12, lineHeight: 16, color: '#A6A6AA', marginTop: 4 },
  dividerBackground: { height: 0.97, backgroundColor: '#262626' },
  divider: { height: 0.97, backgroundColor: '#1A1A1A', marginHorizontal: 25 },
  premiumBanner: { height: 84, overflow: 'hidden' },
  premiumGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, gap: 15 },
  crownBox: { width: 50, height: 50, borderRadius: 5, backgroundColor: 'rgba(35,13,95,0.45)', justifyContent: 'center', alignItems: 'center' },
  premiumTitle: { fontFamily: 'Ubuntu-Bold', fontSize: 18, lineHeight: 24, color: '#FFFFFF' },
  premiumSubtitle: { fontFamily: 'Ubuntu-Medium', fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  rateCard: { marginTop: 24, minHeight: 107, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  rateEmoji: { fontSize: 24 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 2, marginBottom: 40 },
  socialBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { height: 45, alignSelf: 'center', paddingHorizontal: 21, borderRadius: 25, backgroundColor: '#454545', justifyContent: 'center' },
  logoutText: { fontFamily: 'Ubuntu-Bold', fontSize: 14, color: '#FFFFFF' },
});

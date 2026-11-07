import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  Linking,
  FlatList,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/store/authStore';
import { useLocationStore } from '../../src/store/locationStore';
import { useLanguageStore } from '../../src/store/languageStore';
import { usePlayerStore } from '../../src/store/playerStore';
import { AvatarWithFallback } from '../../src/components/AvatarWithFallback';
// RewardedAdButton - platform-specific import (only on native)
const RewardedAdButton = Platform.OS !== 'web' 
  ? require('../../src/components/RewardedAdButton.native').RewardedAdButton
  : () => null;
const AdPrivacyOptions = Platform.OS !== 'web'
  ? require('../../src/components/AdPrivacyOptions.native').AdPrivacyOptions
  : () => null;
import api from '../../src/services/api';
import userService from '../../src/services/userService';
import { profileShareContent } from '../../src/utils/profileShare';
import API_ENDPOINTS from '../../src/constants/api';
import { LogoutModal } from '../../src/components/LogoutModal';
import { usePremiumStore } from '../../src/store/premiumStore';
import { PremiumPaywall } from '../../src/components/PremiumPaywall';
import { rateUsService } from '../../src/services/rateUsService';

import { useSongHistoryStore } from '../../src/store/songHistoryStore';
import appService, { AppInfo } from '../../src/services/appService';

// Language display names
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

// Country type for rich format
interface CountryData {
  name: string;
  nativeName: string;
  code: string;
  flag: string;
  flagUrl: string;
  stationCount: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { country, setCountryManual } = useLocationStore();
  const { currentLanguage, languageVersion } = useLanguageStore();
  const { isMiniPlayerVisible } = usePlayerStore();
  const insets = useSafeAreaInsets();
  
  // Calculate bottom padding for mini-player and tab bar
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;
  const MINI_PLAYER_HEIGHT = 70;
  const bottomPadding = isMiniPlayerVisible 
    ? TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + insets.bottom + 20
    : TAB_BAR_HEIGHT + insets.bottom + 20;

  const [notifications, setNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setNotifications(false);
    setNotificationsLoading(true);
    if (!user?._id || Platform.OS === 'web') { setNotificationsLoading(false); return; }
    import('../../src/services/pushNotificationService').then(async ({ default: service }) => {
      const enabled = await service.isNotificationsEnabled();
      if (active) setNotifications(enabled);
    }).catch(() => {}).finally(() => { if (active) setNotificationsLoading(false); });
    return () => { active = false; };
  }, [user?._id]);
  const handleNotificationsToggle = async (enabled: boolean) => {
    if (!user?._id) { router.push('/auth-options'); return; }
    const token = useAuthStore.getState().token;
    setNotificationsLoading(true);
    try {
      const service = (await import('../../src/services/pushNotificationService')).default;
      await service.setNotificationsEnabled(enabled);
      if (useAuthStore.getState().token === token) setNotifications(enabled);
    } catch {
      if (useAuthStore.getState().token === token) Alert.alert(t('error', 'Error'), t('notification_settings_failed', 'Notification preferences could not be saved. Please try again.'));
    } finally { if (useAuthStore.getState().token === token) setNotificationsLoading(false); }
  };
  const [privateProfile, setPrivateProfile] = useState(false);
  const [privateProfileLoading, setPrivateProfileLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<'main' | 'account' | 'country'>('main');

  // Account modals
  const [showNameModal, setShowNameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [showPasswordChanged, setShowPasswordChanged] = useState(false);

  const [nameValue, setNameValue] = useState(user?.name || 'Guest');
  const [emailValue, setEmailValue] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Country picker
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  
  // Logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Delete Account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Premium
  const [showPremiumPaywall, setShowPremiumPaywall] = useState(false);
  const [showRemoveAdsPaywall, setShowRemoveAdsPaywall] = useState(false);
  const { isPremium, isRemoveAds, plan } = usePremiumStore();
  useFocusEffect(useCallback(() => {
    if (user?._id) {
      void import('../../src/services/iapService').then(({ iapService }) => iapService.syncSubscriptionFromBackend()).catch(() => {});
    }
  }, [user?._id]));
  const manageSubscription = async () => {
    try {
      const { iapService } = await import('../../src/services/iapService');
      await iapService.manageSubscriptions();
    } catch (error: any) { Alert.alert(t('error', 'Error'), error.message); }
  };
  const songHistoryEntries = useSongHistoryStore((s) => s.entries);
  
  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [sharingProfile, setSharingProfile] = useState(false);
  const shareProfile = async () => {
    if (!user || sharingProfile) return;
    const owner = user._id || user.id;
    setSharingProfile(true);
    try {
      const { title, message } = await profileShareContent(user);
      const current = useAuthStore.getState().user;
      if ((current?._id || current?.id) !== owner) return;
      await Share.share({ title, message });
    } catch (error) {
      Alert.alert(t('share', 'Share'), error instanceof Error ? error.message : 'Profil paylaşılamadı.');
    } finally { setSharingProfile(false); }
  };

  // App info from API
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  // Play at login setting
  const [playAtLoginSetting, setPlayAtLoginSetting] = useState<string>('last_played');

  const userName = user?.name || user?.fullName || nameValue || 'Guest';
  const userEmail = user?.email || 'guest@megaradio.com';
  
  // Debug log for avatar issue
  console.log('[Profile] User object:', JSON.stringify(user, null, 2));
  console.log('[Profile] Avatar fields - profilePhoto:', user?.profilePhoto, 'avatar:', user?.avatar);
  
  // Build full avatar URL if relative, with proper empty string check
  const rawAvatar = user?.profilePhoto || user?.avatar;
  const hasValidAvatar = rawAvatar && rawAvatar.trim().length > 0;
  let userAvatar: string | null = null;
  
  if (hasValidAvatar) {
    userAvatar = rawAvatar.startsWith('http') 
      ? rawAvatar 
      : `https://themegaradio.com${rawAvatar}`;
  }
  console.log('[Profile] Final userAvatar:', userAvatar);
  
  // Use real followers/following count from user data
  // Login response may not include these - fetch from API
  const [followersCount, setFollowersCount] = useState(user?.followersCount || 0);
  const [followsCount, setFollowsCount] = useState(user?.followingCount || 0);
  useEffect(() => {
    setNameValue(user?.name || user?.fullName || 'Guest');
    setEmailValue(user?.email || '');
    setLocalAvatar(null);
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

  // Fetch countries from API with rich format (includes flags)
  useEffect(() => {
    if (currentPage === 'country' && countries.length === 0) {
      setCountriesLoading(true);
      api.get(`${API_ENDPOINTS.countries}?format=rich`)
        .then(res => setCountries(res.data || []))
        .catch(() => {})
        .finally(() => setCountriesLoading(false));
    }
  }, [currentPage]);

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

  // Load play at login setting
  useEffect(() => {
    const loadPlayAtLogin = async () => {
      try {
        const stored = await AsyncStorage.getItem('play_at_login_setting');
        if (stored) {
          setPlayAtLoginSetting(stored);
        }
      } catch (e) {
        console.log('Failed to load play at login setting:', e);
      }
    };
    loadPlayAtLogin();
  }, []);

  // Handle private profile toggle
  const handlePrivateProfileToggle = async (value: boolean) => {
    if (!user) return;
    
    setPrivateProfileLoading(true);
    const previousValue = privateProfile;
    
    // Optimistic update
    setPrivateProfile(value);
    
    try {
      // API expects isPublicProfile (inverse of privateProfile)
      await api.put('/api/auth/profile', {
        isPublicProfile: !value
      });
      
      // Update user in auth store
      const { updateUser } = useAuthStore.getState();
      if (updateUser) {
        updateUser({ ...user, isPublicProfile: !value });
      }
    } catch (error) {
      console.error('Failed to update profile privacy:', error);
      // Revert on error
      setPrivateProfile(previousValue);
    } finally {
      setPrivateProfileLoading(false);
    }
  };

  const filteredCountries = countrySearch
    ? countries.filter(c => 
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.nativeName.toLowerCase().includes(countrySearch.toLowerCase())
      )
    : countries;

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
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      const msg = error?.response?.data?.message || t('delete_account_error', 'Could not delete account. Please try again.');
      Alert.alert(t('error', 'Error'), msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEmailSend = () => {
    setShowEmailModal(false);
    setShowVerificationPopup(true);
    setTimeout(() => setShowVerificationPopup(false), 3000);
  };

  const handlePasswordDone = () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setShowPasswordModal(false);
    setShowPasswordChanged(true);
    setTimeout(() => setShowPasswordChanged(false), 3000);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  };

  const handleCountrySelect = (countryData: CountryData) => {
    setCountryManual(countryData.name);
    setCurrentPage('main');
  };

  // Avatar upload handler
  const handleAvatarUpload = async () => {
    // If user has an avatar, show options (change/delete)
    if (hasValidAvatar || localAvatar) {
      Alert.alert(
        t('avatar', 'Profile Photo'),
        t('avatar_options', 'What would you like to do?'),
        [
          { text: t('change_photo', 'Change Photo'), onPress: pickAndUploadAvatar },
          { text: t('remove_photo', 'Remove Photo'), style: 'destructive', onPress: handleAvatarDelete },
          { text: t('cancel', 'Cancel'), style: 'cancel' },
        ]
      );
    } else {
      await pickAndUploadAvatar();
    }
  };

  // Pick image and upload
  const pickAndUploadAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(t('permission_required', 'Permission Required'), t('photo_library_permission', 'Please allow access to your photo library to upload an avatar.'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setAvatarUploading(true);
      setLocalAvatar(asset.uri);

      const formData = new FormData();
      const fileName = asset.uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(fileName);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('avatar', {
        uri: asset.uri,
        name: fileName,
        type,
      } as any);

      const response = await userService.uploadAvatar(formData);

      if (response?.avatar || response?.success) {
        const newAvatarUrl = response.avatar;
        const { updateUser } = useAuthStore.getState();
        if (updateUser && user) {
          updateUser({ ...user, avatar: newAvatarUrl, profilePhoto: newAvatarUrl });
        }
        Alert.alert(t('success', 'Success'), t('avatar_updated', 'Avatar updated successfully!'));
      }
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      setLocalAvatar(null);
      const msg = error.response?.data?.error || error.response?.data?.message || t('avatar_upload_failed', 'Failed to upload avatar. Please try again.');
      Alert.alert(t('error', 'Error'), msg);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Avatar delete handler
  const handleAvatarDelete = async () => {
    try {
      setAvatarUploading(true);
      await userService.deleteAvatar();
      
      setLocalAvatar(null);
      const { updateUser } = useAuthStore.getState();
      if (updateUser && user) {
        updateUser({ ...user, avatar: null, profilePhoto: null });
      }
      Alert.alert(t('success', 'Success'), t('avatar_removed', 'Avatar removed.'));
    } catch (error: any) {
      console.error('Avatar delete error:', error);
      Alert.alert(t('error', 'Error'), t('avatar_delete_failed', 'Failed to remove avatar.'));
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── COUNTRY PICKER ──
  if (currentPage === 'country') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => setCurrentPage('main')}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.subTitle}>{t('country', 'Country')}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            placeholder={t('search_country', 'Search Country')}
            placeholderTextColor="#999"
            value={countrySearch}
            onChangeText={setCountrySearch}
          />
          <Ionicons name="search" size={20} color="#999" />
        </View>

        {countriesLoading ? (
          <ActivityIndicator size="large" color="#FF4199" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => {
              const isSelected = item.name === country || item.nativeName === country;
              return (
                <TouchableOpacity
                  style={[s.countryRow, isSelected && s.countryRowActive]}
                  onPress={() => handleCountrySelect(item)}
                >
                  {item.flagUrl ? (
                    <Image
                      source={{ uri: item.flagUrl }}
                      style={s.flagImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={s.flagEmoji}>{item.flag}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.countryName}>{item.name}</Text>
                    {item.nativeName !== item.name && (
                      <Text style={s.countryNative}>{item.nativeName}</Text>
                    )}
                  </View>
                  <Text style={s.stationCount}>{item.stationCount}</Text>
                  <View style={[s.radioCircle, isSelected && s.radioCircleActive]}>
                    {isSelected && <View style={s.radioCircleFill} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── ACCOUNT SCREEN ──
  if (currentPage === 'account') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.subHeader}>
          <TouchableOpacity onPress={() => setCurrentPage('main')}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.subTitle}>{t('account', 'Account')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingTop: 8 }}>
          <TouchableOpacity style={s.accountRow} onPress={() => setShowNameModal(true)}>
            <View><Text style={s.aLabel}>{t('name', 'Name')}</Text><Text style={s.aValue}>{nameValue}</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.accountRow} onPress={() => setShowEmailModal(true)}>
            <View><Text style={s.aLabel}>{t('email', 'Email')}</Text><Text style={s.aValue}>{userEmail}</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.accountRow} onPress={() => setShowPasswordModal(true)}>
            <Text style={s.aLabel}>{t('password', 'Password')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Name Modal */}
        <Modal visible={showNameModal} transparent animationType="fade">
          <View style={s.mOverlay}><View style={s.mBox}>
            <Text style={s.mTitle}>{t('change_name', 'Change your name')}</Text>
            <View style={s.mInputRow}>
              <TextInput style={s.mInput} value={nameValue} onChangeText={setNameValue} placeholder={t('name', 'Name')} placeholderTextColor="#666" autoFocus />
              {nameValue.length > 0 && <TouchableOpacity onPress={() => setNameValue('')}><Ionicons name="close-circle" size={20} color="#999" /></TouchableOpacity>}
            </View>
            <View style={s.mActions}>
              <TouchableOpacity onPress={() => setShowNameModal(false)}><Text style={s.mCancel}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={s.mPinkBtn} onPress={() => setShowNameModal(false)}><Text style={s.mPinkText}>{t('done', 'Done')}</Text></TouchableOpacity>
            </View>
          </View></View>
        </Modal>

        {/* Email Modal */}
        <Modal visible={showEmailModal} transparent animationType="fade">
          <View style={s.mOverlay}><View style={s.mBox}>
            <Text style={s.mTitle}>{t('change_email', 'Change your email')}</Text>
            <View style={s.mInputRow}>
              <TextInput style={s.mInput} value={emailValue} onChangeText={setEmailValue} placeholder={t('email', 'Email')} placeholderTextColor="#666" keyboardType="email-address" autoFocus />
            </View>
            <View style={s.mActions}>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}><Text style={s.mCancel}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={s.mPinkBtn} onPress={handleEmailSend}><Text style={s.mPinkText}>{t('save', 'Save')}</Text></TouchableOpacity>
            </View>
          </View></View>
        </Modal>

        {/* Verification Popup */}
        <Modal visible={showVerificationPopup} transparent animationType="fade">
          <View style={s.mOverlay}><View style={s.mBox}>
            <View style={s.checkCircle}><Ionicons name="checkmark" size={32} color="#FF4199" /></View>
            <Text style={s.mTitle}>{t('verification_sent', 'We sent you a verification mail!')}</Text>
            <Text style={s.mSub}>{t('check_mail', 'Please check your mail')}</Text>
          </View></View>
        </Modal>

        {/* Password Modal */}
        <Modal visible={showPasswordModal} transparent animationType="fade">
          <View style={s.mOverlay}><View style={s.mBox}>
            <Text style={s.mTitle}>{t('change_password', 'Change your password')}</Text>
            {[
              { val: currentPassword, set: setCurrentPassword, show: showCurrentPw, toggle: () => setShowCurrentPw(!showCurrentPw), ph: t('current_password', 'Current password') },
              { val: newPassword, set: setNewPassword, show: showNewPw, toggle: () => setShowNewPw(!showNewPw), ph: t('new_password', 'New password') },
              { val: confirmPassword, set: setConfirmPassword, show: showConfirmPw, toggle: () => setShowConfirmPw(!showConfirmPw), ph: t('confirm_password', 'Confirm new password') },
            ].map((f, i) => (
              <View key={i} style={s.pwRow}>
                <TextInput style={s.pwInput} value={f.val} onChangeText={f.set} placeholder={f.ph} placeholderTextColor="#666" secureTextEntry={!f.show} />
                <TouchableOpacity onPress={f.toggle}><Ionicons name={f.show ? 'eye' : 'eye-off'} size={20} color="#999" /></TouchableOpacity>
              </View>
            ))}
            <View style={s.mActions}>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}><Text style={s.mCancel}>{t('cancel', 'Cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={s.mPinkBtn} onPress={handlePasswordDone}><Text style={s.mPinkText}>{t('done', 'Done')}</Text></TouchableOpacity>
            </View>
          </View></View>
        </Modal>

        {/* Password Changed */}
        <Modal visible={showPasswordChanged} transparent animationType="fade">
          <View style={s.mOverlay}><View style={s.mBox}>
            <View style={s.checkCircle}><Ionicons name="checkmark" size={32} color="#FF4199" /></View>
            <Text style={s.mTitle}>{t('password_changed', 'Your password was changed!')}</Text>
          </View></View>
        </Modal>
      </SafeAreaView>
    );
  }

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
            {!isPremium && !isRemoveAds && (
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
                  <Text style={{ fontSize: 13, color: '#888', fontFamily: 'Ubuntu-Regular', marginRight: 8 }}>
                    {t('see_store_prices', 'View local prices')}
                  </Text>
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
            <AdPrivacyOptions />

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
              onPress={() => setCurrentPage('country')}
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
              onPress={() => { void rateUsService.openStoreReview(); }}
              data-testid="profile-rate-us-btn"
            >
              <Ionicons name="star-outline" size={22} color="#FFF" style={s.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowText}>{t('rate_us', 'Rate Us')}</Text>
                <Text style={s.rowSubtext}>{t('rate_us_invite', 'Share your experience')}</Text>
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
          source="profile"
          visible={showPremiumPaywall}
          onClose={() => setShowPremiumPaywall(false)}
          mode="premium"
        />
        
        {/* Remove Ads Paywall (guest) */}
        <PremiumPaywall
          source="profile"
          visible={showRemoveAdsPaywall}
          onClose={() => setShowRemoveAdsPaywall(false)}
          mode="remove_ads"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatarRow}>
            <TouchableOpacity 
              style={s.avatar}
              onPress={handleAvatarUpload}
              disabled={avatarUploading}
              data-testid="profile-avatar-btn"
            >
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#FF4199" />
              ) : localAvatar ? (
                <Image 
                  source={{ uri: localAvatar }} 
                  style={s.avatarImage}
                  onError={() => console.log('[Profile Avatar] Local preview failed to load')}
                />
              ) : (
                <AvatarWithFallback 
                  uri={rawAvatar} 
                  size={56} 
                />
              )}
              {/* Camera badge */}
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{userName}</Text>
              <View style={s.statsRow}>
                <TouchableOpacity 
                  style={s.statTouchable}
                  onPress={() => router.push('/followers')} 
                  data-testid="profile-followers-btn"
                >
                  <Text style={s.statNumber}>{followersCount}</Text>
                  <Text style={s.statLabel}>{t('followers', 'Followers')}</Text>
                </TouchableOpacity>
                <View style={s.statDivider} />
                <TouchableOpacity 
                  style={s.statTouchable}
                  onPress={() => router.push('/follows')} 
                  data-testid="profile-follows-btn"
                >
                  <Text style={s.statNumber}>{followsCount}</Text>
                  <Text style={s.statLabel}>{t('follows', 'Follows')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity testID="profile-share-button" onPress={shareProfile} disabled={sharingProfile}
              accessibilityLabel={t('share_profile', 'Share profile')} style={s.shareButton}>
              {sharingProfile ? <ActivityIndicator testID="profile-share-loading" color="#FFF" /> : <Ionicons name="share-outline" size={22} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Section - EN ÜSTTE */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('premium', 'Premium')}</Text>
          
          {/* Go Premium Button */}
          {!isPremium && (
            <TouchableOpacity
              style={[s.row, { backgroundColor: 'rgba(255,215,0,0.06)' }]}
              onPress={() => setShowPremiumPaywall(true)}
              data-testid="go-premium-btn"
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
          {(isPremium || isRemoveAds) && (
            <View style={[s.row, { backgroundColor: 'rgba(255,215,0,0.06)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                <Ionicons name="diamond" size={20} color="#FFD700" />
                <Text style={[s.rowTitle, { color: '#FFD700' }]}>{isPremium ? t('premium_active', 'Premium Active') : t('ad_free_active', 'Ad-free Active')}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
          )}
          {(isPremium || isRemoveAds) && plan !== 'premium_lifetime' && Platform.OS !== 'web' && (
            <TouchableOpacity style={s.row} onPress={manageSubscription} testID="manage-subscription-btn">
              <Text style={[s.rowTitle, { flex: 1 }]}>{t('manage_subscription', 'Manage subscription')}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}
          <View style={s.divider} />

          {/* Remove Ads (only for non-premium, non-removeAds users) */}
          {!isPremium && !isRemoveAds && (
            <>
              <TouchableOpacity
                style={s.row}
                onPress={() => setShowRemoveAdsPaywall(true)}
                data-testid="remove-ads-btn"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                  <Ionicons name="ban-outline" size={20} color="#FF4199" />
                  <Text style={s.rowTitle}>{t('remove_ads', 'Remove Ads')}</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#888', fontFamily: 'Ubuntu-Regular', marginRight: 8 }}>
                  {t('see_store_prices', 'View local prices')}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              <View style={s.divider} />
            </>
          )}

          {/* Rewarded Ad - Watch Ad for 30 min free (hidden for premium/ad-free users) */}
          {!isPremium && !isRemoveAds && (
            <>
              <RewardedAdButton />
              <View style={s.divider} />
            </>
          )}

          {/* Song History */}
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/song-history' as any)}
            data-testid="song-history-btn"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={s.rowTitle}>{t('song_history', 'Song History')}</Text>
            </View>
            {songHistoryEntries.length > 0 && (
              <Text style={{ fontSize: 13, color: '#888', fontFamily: 'Ubuntu-Regular', marginRight: 8 }}>
                {songHistoryEntries.length}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <Text style={s.sectionLabel}>{t('settings', 'Settings')}</Text>
        <AdPrivacyOptions />
        {[
          { 
            title: t('play_at_login', 'Play at Login'), 
            sub: playAtLoginSetting === 'last_played' ? t('last_played', 'Last Played') 
               : playAtLoginSetting === 'random' ? t('random', 'Random')
               : playAtLoginSetting === 'favorite' ? t('favorite', 'Favorite')
               : t('off', 'Off'),
            onPress: () => router.push('/play-at-login') 
          },
          { title: t('country', 'Country'), sub: country || t('not_set', 'Not set'), onPress: () => setCurrentPage('country') },
          { title: t('language', 'Language'), sub: LANGUAGE_NAMES[currentLanguage] || currentLanguage, onPress: () => router.push('/languages' as any) },
          { title: t('statistics', 'Statistics'), onPress: () => router.push('/statistics') },
          { title: t('account', 'Account'), onPress: () => setCurrentPage('account') },
        ].map((item, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity style={s.row} onPress={item.onPress}>
              <View>
                <Text style={s.rowTitle}>{item.title}</Text>
                {item.sub && <Text style={s.rowSub}>{item.sub}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
            <View style={s.divider} />
          </React.Fragment>
        ))}

        <View style={s.row}>
          <Text style={s.rowTitle}>{t('notifications_setting', 'Notifications')}</Text>
          <Switch value={notifications} onValueChange={handleNotificationsToggle} disabled={notificationsLoading || Platform.OS === 'web'} trackColor={{ false: '#333', true: '#FF4199' }} thumbColor="#FFF" />
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.rowTitle}>{t('private_profile', 'Private Profile')}</Text>
          <Switch 
            value={privateProfile} 
            onValueChange={handlePrivateProfileToggle} 
            trackColor={{ false: '#333', true: '#FF4199' }} 
            thumbColor="#FFF"
            disabled={privateProfileLoading}
          />
        </View>

        {/* About */}
        <Text style={s.sectionLabel}>{t('about', 'About')}</Text>
        <TouchableOpacity
          style={s.row}
          onPress={() => { void rateUsService.openStoreReview(); }}
          data-testid="profile-rate-us-btn-guest"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{t('rate_us', 'Rate Us')}</Text>
            <Text style={s.rowSubtext}>{t('rate_us_invite', 'Share your experience')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'about' } } as any)}>
          <Text style={s.rowTitle}>{t('about_us', 'About Us')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'privacy' } } as any)}>
          <Text style={s.rowTitle}>{t('privacy_policy', 'Privacy Policy')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
        <View style={s.divider} />
        <TouchableOpacity style={s.row} onPress={() => router.push({ pathname: '/static-page', params: { type: 'terms' } } as any)}>
          <Text style={s.rowTitle}>{t('terms_conditions', 'Terms and Conditions')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Social */}
        <Text style={[s.sectionLabel, { textAlign: 'center', backgroundColor: 'transparent' }]}>{t('social_media', 'Social Media')}</Text>
        <View style={s.socialRow}>
          {[
            { name: 'facebook-f' as const, bg: '#3b5998', url: appInfo?.social?.facebook },
            { name: 'instagram' as const, bg: '#C13584', url: appInfo?.social?.instagram },
            { name: 'twitter' as const, bg: '#1DA1F2', url: appInfo?.social?.twitter },
          ].map((soc) => (
            <TouchableOpacity 
              key={soc.name} 
              style={[s.socialBtn, { backgroundColor: soc.bg }]}
              onPress={() => soc.url && Linking.openURL(soc.url)}
            >
              <FontAwesome5 name={soc.name} size={22} color="#FFF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={() => setShowLogoutModal(true)} data-testid="profile-logout-btn">
          <Text style={s.logoutText}>{t('log_out', 'Log Out')}</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity 
          style={s.deleteAccountBtn} 
          onPress={() => setShowDeleteModal(true)} 
          data-testid="delete-account-btn"
        >
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          <Text style={s.deleteAccountText}>{t('delete_account', 'Delete Account')}</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Logout Modal */}
      <LogoutModal
        visible={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={s.deleteOverlay}>
          <View style={s.deleteContainer}>
            <Ionicons name="warning" size={40} color="#FF3B30" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={s.deleteTitle}>{t('delete_account_title', 'Delete Account')}</Text>
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
              data-testid="delete-confirm-input"
            />
            <View style={s.deleteButtonRow}>
              <TouchableOpacity 
                style={s.deleteCancelBtn} 
                onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                data-testid="delete-cancel-btn"
              >
                <Text style={s.deleteCancelText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.deleteConfirmBtn, deleteConfirmText.toLowerCase() !== 'delete' && { opacity: 0.4 }]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleteLoading}
                data-testid="delete-confirm-btn"
              >
                {deleteLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={s.deleteConfirmText}>{t('delete_permanently', 'Delete Permanently')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Paywall */}
      <PremiumPaywall
          source="profile"
        visible={showPremiumPaywall}
        onClose={() => setShowPremiumPaywall(false)}
        mode="premium"
      />

      {/* Remove Ads Paywall */}
      <PremiumPaywall
          source="profile"
        visible={showRemoveAdsPaywall}
        onClose={() => setShowRemoveAdsPaywall(false)}
        mode="remove_ads"
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
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  deleteContainer: { width: '100%', backgroundColor: '#1B1C1E', borderRadius: 16, padding: 24 },
  deleteTitle: { fontSize: 20, fontFamily: 'Ubuntu-Bold', color: '#FF3B30', textAlign: 'center', marginBottom: 8 },
  deleteDesc: { fontSize: 14, fontFamily: 'Ubuntu-Regular', color: '#AAA', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  deleteConfirmLabel: { fontSize: 14, fontFamily: 'Ubuntu-Medium', color: '#FFF', marginBottom: 8 },
  deleteInput: { backgroundColor: '#2A2A2A', borderRadius: 10, paddingHorizontal: 16, height: 44, fontSize: 16, fontFamily: 'Ubuntu-Regular', color: '#FFF', marginBottom: 20 },
  deleteButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  deleteCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#333', alignItems: 'center' },
  deleteCancelText: { fontSize: 15, fontFamily: 'Ubuntu-Medium', color: '#FFF' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center' },
  deleteConfirmText: { fontSize: 15, fontFamily: 'Ubuntu-Bold', color: '#FFF' },
});

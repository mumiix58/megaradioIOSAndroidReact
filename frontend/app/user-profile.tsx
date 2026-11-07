import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import { getStationLogoUrl, DEFAULT_STATION_LOGO_URL } from '../src/utils/stationLogoHelper';
import { useUserFavorites, useUserProfile } from '../src/hooks/useQueries';
import { getPreloadedFavorites } from '../src/services/preloadService';
import { useAudioPlayer } from '../src/hooks/useAudioPlayer';
import { ImageWithFallback } from '../src/components/ImageWithFallback';
import { profileShareContent } from '../src/utils/profileShare';

interface FavoriteStation {
  id: string;
  name: string;
  genre: string;
  logo: string;
}

const STATIONS_PER_PAGE = 29;

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId: string; userName: string; userAvatar: string; userSlug: string }>();
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const { playStation } = useAudioPlayer();
  const [allStations, setAllStations] = useState<FavoriteStation[]>([]);
  const [visibleCount, setVisibleCount] = useState(STATIONS_PER_PAGE);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // User info from params - build full avatar URL SAFELY
  const userName = params.userName || 'User';
  const rawAvatar = params.userAvatar || '';
  const userAvatar = (() => {
    if (!rawAvatar || rawAvatar === 'null' || rawAvatar === 'undefined' || rawAvatar.trim() === '') {
      return 'https://themegaradio.com/images/default-avatar.png';
    }
    if (rawAvatar.startsWith('http')) return rawAvatar;
    if (rawAvatar.startsWith('/')) return `https://themegaradio.com${rawAvatar}`;
    return 'https://themegaradio.com/images/default-avatar.png';
  })();
  const userId = params.userId || '';
  const isOwnProfile = currentUser?._id === userId;

  // Use React Query with preloaded data support
  const { data: favoritesData, isLoading: favoritesLoading } = useUserFavorites(userId);
  const { data: profileData } = useUserProfile(userId);

  // Check for preloaded data first
  useEffect(() => {
    setAllStations([]);
    setVisibleCount(STATIONS_PER_PAGE);
    setFollowerCount(0);
    setFollowingCount(0);
    setIsFollowing(false);
    if (userId) {
      try {
        const preloaded = getPreloadedFavorites(userId);
        if (preloaded && Array.isArray(preloaded)) {
          console.log('[UserProfile] Using preloaded favorites');
          setAllStations(preloaded.map((s: any) => ({
            id: s?._id || s?.id || '',
            name: s?.name || 'Unknown Station',
            genre: s?.genre || 'Radio',
            logo: getStationLogoUrl(s) || DEFAULT_STATION_LOGO_URL,
          })));
        }
      } catch (e) {
        console.log('[UserProfile] Preload cache error (non-fatal):', e);
      }
    }
  }, [userId]);

  // Update stations when React Query data arrives
  useEffect(() => {
    try {
      if (Array.isArray(favoritesData)) {
        setAllStations(favoritesData.map((s: any) => ({
          id: s?._id || s?.id || '',
          name: s?.name || 'Unknown Station',
          genre: s?.genre || 'Radio',
          logo: getStationLogoUrl(s) || DEFAULT_STATION_LOGO_URL,
        })));
      }
    } catch (e) {
      console.log('[UserProfile] Error processing favorites data:', e);
    }
  }, [favoritesData]);

  // Paginated stations - show only visibleCount items
  const stations = useMemo(() => {
    return allStations.slice(0, visibleCount);
  }, [allStations, visibleCount]);

  // Check if there are more stations to show
  const hasMoreStations = allStations.length > visibleCount;
  const remainingCount = allStations.length - visibleCount;

  // Load more stations handler
  const handleLoadMore = () => {
    setVisibleCount(prev => prev + STATIONS_PER_PAGE);
  };

  // Update profile counts from React Query (SINGLE SOURCE OF TRUTH)
  // DO NOT use separate follower/following API endpoints - they fail!
  // profileData from /api/user-profile/:id returns correct followersCount/followingCount
  useEffect(() => {
    if (profileData) {
      const fc = profileData.followersCount ?? profileData.followers_count ?? profileData.followers ?? 0;
      const gc = profileData.followingCount ?? profileData.following_count ?? profileData.following ?? 0;
      setFollowerCount(typeof fc === 'number' ? fc : 0);
      setFollowingCount(typeof gc === 'number' ? gc : 0);
    }
  }, [profileData]);

  // Load additional profile data (follow status)
  useEffect(() => {
    loadFollowStatus();
  }, [userId, isAuthenticated]);

  const loadFollowStatus = async () => {
    if (!userId || !isAuthenticated || isOwnProfile) return;

    // Use the dedicated is-following endpoint (now supports Bearer auth)
    try {
      const res = await api.get(`/api/user/is-following/${userId}`);
      setIsFollowing(res.data?.isFollowing || false);
    } catch (e: any) {
      console.log('[UserProfile] Could not check following status:', e?.response?.status);
      setIsFollowing(false);
    }
  };

  const loading = favoritesLoading && allStations.length === 0;

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      // Navigate to login with return URL to come back after login
      router.push({
        pathname: '/auth-options',
        params: {
          returnTo: '/user-profile',
          returnParams: JSON.stringify({ userId, userName, userAvatar: rawAvatar })
        }
      });
      return;
    }

    if (!userId) return;

    // Optimistic update - UI'ı hemen güncelle
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount(prev => wasFollowing ? Math.max(0, prev - 1) : prev + 1);
    setFollowLoading(true);

    try {
      if (wasFollowing) {
        // Backend expects DELETE for unfollow
        await api.delete(`/api/user/unfollow/${userId}`);
      } else {
        // Backend expects POST for follow
        await api.post(`/api/user/follow/${userId}`);
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || '';
      console.error('[UserProfile] Follow/unfollow error:', {
        status,
        message: msg,
        url: wasFollowing ? `/api/user/unfollow/${userId}` : `/api/user/follow/${userId}`,
        method: wasFollowing ? 'DELETE' : 'POST',
      });
      // Hata durumunda geri al
      setIsFollowing(wasFollowing);
      setFollowerCount(prev => wasFollowing ? prev + 1 : Math.max(0, prev - 1));
      
      // Show specific error based on status
      if (status === 401) {
        Alert.alert('Authentication Error', 'Please log out and log back in to use this feature.');
      } else {
        Alert.alert('Error', `Failed to ${wasFollowing ? 'unfollow' : 'follow'} user. (${status || 'Network error'})`);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePlayStation = async (station: FavoriteStation) => {
    console.log('[UserProfile] Play station:', station.name, 'id:', station.id);
    
    if (!station.id) {
      console.warn('[UserProfile] No station ID, cannot play');
      return;
    }
    
    // Fetch full station data first - need stream URL for TrackPlayer
    try {
      const response = await api.get(`/api/station/${station.id}`);
      if (response.data && (response.data.url || response.data.streamUrl)) {
        await playStation(response.data);
      } else {
        console.warn('[UserProfile] Station has no stream URL');
      }
    } catch (error) {
      console.error('[UserProfile] Error fetching station:', error);
    }
  };

  const handleShare = async (platform: string) => {
    try {
      const { title, message, url } = await profileShareContent({ _id: userId, slug: params.userSlug, name: userName });
      if (platform === 'copy') await Clipboard.setStringAsync(url);
      else if (platform === 'facebook') await Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
      else if (platform === 'twitter') await Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`);
      else await Share.share({ title, message });
      setShowShareModal(false);
    } catch (error) { Alert.alert('Paylaşım', error instanceof Error ? error.message : 'Profil paylaşılamadı.'); }
  };

  const renderStation = ({ item }: { item: FavoriteStation }) => {
    // CRASH FIX: NEVER pass undefined/null/empty uri to native Image component
    const logoUri = item.logo && item.logo.trim() && item.logo !== 'null' && item.logo !== 'undefined'
      ? item.logo
      : DEFAULT_STATION_LOGO_URL;
    
    return (
      <View style={styles.stationCard}>
        <ImageWithFallback testID={`public-profile-station-logo-${item.id}`} uri={logoUri} style={styles.stationLogo} />
        <View style={styles.stationInfo}>
          <Text style={styles.stationName}>{item.name || 'Unknown Station'}</Text>
          <Text style={styles.stationGenre}>{item.genre || ''}</Text>
        </View>
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={() => handlePlayStation(item)}
          data-testid={`play-station-${item.id || 'unknown'}`}
        >
          <Ionicons name="play" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="user-profile-back-btn">
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Image source={{ uri: userAvatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{userName}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>Followers <Text style={styles.statNumber}>{followerCount}</Text></Text>
            <Text style={styles.statText}>  Follows <Text style={styles.statNumber}>{followingCount}</Text></Text>
          </View>
        </View>
        {!isOwnProfile && (
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing && styles.followingBtn]} 
            onPress={handleFollowToggle}
            disabled={followLoading}
            data-testid="user-profile-follow-btn"
          >
            {followLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.followBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.shareBtn} 
          onPress={() => setShowShareModal(true)}
          testID="user-profile-share-btn"
        >
          <Ionicons name="share-social-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Stations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF4081" />
        </View>
      ) : (
        <FlatList
          data={stations}
          renderItem={renderStation}
          keyExtractor={(item, index) => item.id || `station-${index}`}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No favorite stations yet</Text>
          }
          ListFooterComponent={
            hasMoreStations ? (
              <TouchableOpacity 
                style={styles.seeMoreBtn} 
                onPress={handleLoadMore}
                data-testid="see-more-stations-btn"
              >
                <Text style={styles.seeMoreText}>
                  Daha Fazla Gör ({remainingCount} istasyon daha)
                </Text>
                <Ionicons name="chevron-down" size={18} color="#FF4081" />
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Share Modal */}
      <Modal testID="public-profile-share-modal" visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowShareModal(false)}
        >
          <View style={{ flex: 1 }} />
        </TouchableOpacity>
        
        <View style={[styles.shareSheet, { paddingBottom: insets.bottom || 20 }]}>
          <View style={styles.sheetHandle} />
          
          {/* Social Icons Row */}
          <View style={styles.socialRow}>
            <TouchableOpacity testID="public-profile-share-facebook" style={[styles.socialBtn, { backgroundColor: '#3B5998' }]} onPress={() => handleShare('facebook')}>
              <FontAwesome5 name="facebook-f" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity testID="public-profile-share-instagram" style={[styles.socialBtn, { backgroundColor: '#E4405F' }]} onPress={() => handleShare('instagram')}>
              <FontAwesome5 name="instagram" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity testID="public-profile-share-twitter" style={[styles.socialBtn, { backgroundColor: '#1DA1F2' }]} onPress={() => handleShare('twitter')}>
              <FontAwesome5 name="twitter" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity testID="public-profile-share-whatsapp" style={[styles.socialBtn, { backgroundColor: '#25D366' }]} onPress={() => handleShare('whatsapp')}>
              <FontAwesome5 name="whatsapp" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Copy Link */}
          <TouchableOpacity testID="public-profile-share-copy" style={styles.shareOption} onPress={() => handleShare('copy')}>
            <View style={styles.shareOptionIcon}>
              <Ionicons name="link-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.shareOptionText}>Copy Link</Text>
          </TouchableOpacity>

          {/* More */}
          <TouchableOpacity testID="public-profile-share-more" style={styles.shareOption} onPress={() => handleShare('more')}>
            <View style={styles.shareOptionIcon}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.shareOptionText}>More</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statText: {
    fontSize: 13,
    color: '#888888',
  },
  statNumber: {
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
  },
  shareBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBtn: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: '#3A3A3A',
  },
  followBtnText: {
    fontFamily: 'Ubuntu-Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90, // Space for MiniPlayer (70px) + extra padding
  },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stationLogo: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
  },
  stationInfo: {
    flex: 1,
    marginLeft: 14,
  },
  stationName: {
    fontSize: 17,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stationGenre: {
    fontSize: 14,
    color: '#888888',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 40,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 64, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#FF4081',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  seeMoreText: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FF4081',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shareSheet: {
    backgroundColor: '#1B1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#555',
    alignSelf: 'center',
    marginBottom: 20,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  shareOptionIcon: {
    marginRight: 16,
  },
  shareOptionText: {
    fontSize: 16,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
});

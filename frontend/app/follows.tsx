import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../src/services/api';
import { API_ENDPOINTS } from '../src/constants/api';
import { useAuthStore } from '../src/store/authStore';

interface Following {
  _id: string;
  username: string;
  fullName: string;
  avatar?: string;
  slug?: string;
}

const DEFAULT_AVATAR = 'https://themegaradio.com/images/default-avatar.png';

export default function FollowsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [following, setFollowing] = useState<Following[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  useEffect(() => {
    fetchFollowing();
  }, [user]);

  const fetchFollowing = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // API docs: GET /api/user/following/:userId
      const response = await api.get(API_ENDPOINTS.user.following(user._id));
      
      // API returns { following: [{ user: {...}, followedAt: "..." }] }
      const rawData = response.data.following || response.data || [];
      
      // Extract user objects from the nested structure
      const data = rawData.map((item: any) => {
        if (item.user) {
          return {
            ...item.user,
            followedAt: item.followedAt,
          };
        }
        return item;
      });
      
      setFollowing(data);
    } catch (error: any) {
      console.error('Error fetching following:', error);
      setFollowing([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (userId: string, userName: string) => {
    if (!isAuthenticated) {
      Alert.alert(t('login_required', 'Login Required'), t('login_required_follow', 'Please login to manage who you follow.'));
      return;
    }

    Alert.alert(
      t('unfollow', 'Unfollow'),
      t('unfollow_confirm', `Are you sure you want to unfollow ${userName}?`),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('unfollow', 'Unfollow'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUnfollowing(userId);
              // API docs: DELETE /api/user/unfollow/:userId
              await api.delete(API_ENDPOINTS.user.unfollow(userId));
              setFollowing(prev => prev.filter(f => f._id !== userId));
            } catch (error: any) {
              console.error('Error unfollowing:', error);
              Alert.alert(t('error', 'Error'), t('unfollow_failed', 'Failed to unfollow. Please try again.'));
            } finally {
              setUnfollowing(null);
            }
          },
        },
      ]
    );
  };

  const navigateToProfile = (user: Following) => {
    router.push({
      pathname: '/user-profile',
      params: {
        userId: user._id,
        userName: user.fullName || user.username,
        userAvatar: user.avatar || DEFAULT_AVATAR,
      },
    } as any);
  };

  const filteredFollowing = searchQuery
    ? following.filter(f => 
        (f.fullName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.username?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : following;

  const getAvatarUrl = (avatar?: string): string => {
    if (!avatar) return DEFAULT_AVATAR;
    if (avatar.startsWith('http')) return avatar;
    return `https://themegaradio.com${avatar}`;
  };

  const renderItem = ({ item }: { item: Following }) => (
    <View style={styles.row}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => navigateToProfile(item)}
        data-testid={`following-profile-${item._id}`}
      >
        <Image 
          source={{ uri: getAvatarUrl(item.avatar) }} 
          style={styles.avatar} 
        />
        <Text style={styles.name} numberOfLines={1}>
          {item.fullName || item.username}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.unfollowButton}
        onPress={() => handleUnfollow(item._id, item.fullName || item.username)}
        disabled={unfollowing === item._id}
        data-testid={`unfollow-${item._id}`}
      >
        {unfollowing === item._id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.unfollowText}>Unfollow</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="follows-back-btn">
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Following</Text>
        <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchBtn} data-testid="follows-search-btn">
          <Ionicons name="search-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_following', 'Search following...')}
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            data-testid="follows-search-input"
          />
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF4081" />
        </View>
      ) : (
        <FlatList
          data={filteredFollowing}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-add-outline" size={60} color="#444" />
              <Text style={styles.emptyText}>
                {isAuthenticated ? 'Not following anyone yet' : 'Login to see who you follow'}
              </Text>
            </View>
          }
        />
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Ubuntu-Bold',
    color: '#FFFFFF',
  },
  searchBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90, // Space for MiniPlayer
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: '#333',
  },
  name: {
    fontSize: 17,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
    flex: 1,
  },
  unfollowButton: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  unfollowText: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#333333',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
  },
});

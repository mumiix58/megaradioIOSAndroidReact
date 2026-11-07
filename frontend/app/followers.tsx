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

interface Follower {
  _id: string;
  username: string;
  fullName: string;
  avatar?: string;
  slug?: string;
}

const DEFAULT_AVATAR = 'https://themegaradio.com/images/default-avatar.png';

export default function FollowersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchFollowers();
  }, [user]);

  const fetchFollowers = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // API docs: GET /api/user/followers/:userId
      const response = await api.get(API_ENDPOINTS.user.followers(user._id));
      
      // API returns { followers: [{ user: {...}, followedAt: "..." }] }
      const rawData = response.data.followers || response.data || [];
      
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
      
      setFollowers(data);
    } catch (error: any) {
      console.error('Error fetching followers:', error);
      // If user not found or other error, show empty list
      setFollowers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (followerId: string) => {
    if (!isAuthenticated) {
      Alert.alert(t('login_required', 'Login Required'), t('login_required_followers', 'Please login to manage your followers.'));
      return;
    }

    Alert.alert(
      t('remove_follower', 'Remove Follower'),
      t('remove_follower_confirm', 'Are you sure you want to remove this follower?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              setRemoving(followerId);
              // Note: This endpoint may need to be implemented on backend
              // POST /api/user-engagement/remove-follower/:userId
              await api.post(`/api/user-engagement/remove-follower/${followerId}`);
              setFollowers(prev => prev.filter(f => f._id !== followerId));
            } catch (error: any) {
              console.error('Error removing follower:', error);
              Alert.alert(t('error', 'Error'), t('remove_follower_failed', 'Failed to remove follower. Please try again.'));
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  };

  const navigateToProfile = (follower: Follower) => {
    router.push({
      pathname: '/user-profile',
      params: {
        userId: follower._id,
        userName: follower.fullName || follower.username,
        userAvatar: follower.avatar || DEFAULT_AVATAR,
      },
    } as any);
  };

  const filteredFollowers = searchQuery
    ? followers.filter(f => 
        (f.fullName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.username?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : followers;

  const getAvatarUrl = (avatar?: string): string => {
    if (!avatar) return DEFAULT_AVATAR;
    if (avatar.startsWith('http')) return avatar;
    return `https://themegaradio.com${avatar}`;
  };

  const renderItem = ({ item }: { item: Follower }) => (
    <View style={styles.row}>
      <TouchableOpacity 
        style={styles.userInfo}
        onPress={() => navigateToProfile(item)}
        data-testid={`follower-profile-${item._id}`}
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
        style={styles.removeButton}
        onPress={() => handleRemove(item._id)}
        disabled={removing === item._id}
        data-testid={`remove-follower-${item._id}`}
      >
        {removing === item._id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.removeText}>Remove</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="followers-back-btn">
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)} style={styles.searchBtn} data-testid="followers-search-btn">
          <Ionicons name="search-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_followers', 'Search followers...')}
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            data-testid="followers-search-input"
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
          data={filteredFollowers}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#444" />
              <Text style={styles.emptyText}>
                {isAuthenticated ? 'No followers yet' : 'Login to see your followers'}
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
  removeButton: {
    backgroundColor: '#FF4081',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
  },
  removeText: {
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

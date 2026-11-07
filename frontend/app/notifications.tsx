import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../src/services/api';
import { API_ENDPOINTS } from '../src/constants/api';
import { useAuthStore } from '../src/store/authStore';
import { NotificationItemSkeleton } from '../src/components/Skeleton';

interface NotificationData {
  userId?: string;
  userName?: string;
  userAvatar?: string;
  stationId?: string;
  stationName?: string;
  stationLogo?: string;
}

interface Notification {
  _id: string;
  type: 'follow' | 'new_station' | 'like' | 'comment' | 'system';
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: NotificationData;
  // Alternative field names from API
  fromUser?: {
    _id: string;
    username?: string;
    fullName?: string;
    avatar?: string;
  };
  station?: {
    _id: string;
    name: string;
    logo?: string;
    favicon?: string;
  };
}

interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications
  const { data, isLoading, refetch } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', user?._id],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.user.notifications);
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });

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
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification._id);
    }

    // Navigate based on notification type
    const userId = notification.data?.userId || notification.fromUser?._id;
    const userName = notification.data?.userName || notification.fromUser?.fullName || notification.fromUser?.username;
    const userAvatar = notification.data?.userAvatar || notification.fromUser?.avatar;

    if (notification.type === 'follow' && userId) {
      router.push({
        pathname: '/user-profile',
        params: {
          userId,
          userName: userName || 'User',
          userAvatar: userAvatar || '',
        },
      });
    } else if (notification.type === 'new_station') {
      const stationId = notification.data?.stationId || notification.station?._id;
      if (stationId) {
        router.push({
          pathname: '/player',
          params: { stationId },
        });
      }
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US');
  };

  const getAvatarUrl = (notification: Notification): string => {
    // For follow notifications - get user avatar
    if (notification.type === 'follow') {
      const avatar = notification.data?.userAvatar || notification.fromUser?.avatar;
      if (avatar) {
        return avatar.startsWith('http') ? avatar : `https://themegaradio.com${avatar}`;
      }
      return 'https://themegaradio.com/images/default-avatar.png';
    }
    
    // For new station notifications - get station logo
    if (notification.type === 'new_station') {
      const logo = notification.data?.stationLogo || notification.station?.logo || notification.station?.favicon;
      if (logo) {
        return logo.startsWith('http') ? logo : `https://themegaradio.com${logo}`;
      }
      return 'https://themegaradio.com/logo.png';
    }

    return 'https://themegaradio.com/images/default-avatar.png';
  };

  const getNotificationText = (notification: Notification): { main: string; sub?: string } => {
    if (notification.type === 'follow') {
      const name = notification.data?.userName || notification.fromUser?.fullName || notification.fromUser?.username || 'Someone';
      return { main: `${name} started following you` };
    }
    
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
    
    return (
      <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => handleNotificationPress(item)}
        data-testid={`notification-item-${item._id}`}
      >
        {/* Avatar/Logo */}
        <Image 
          source={{ uri: getAvatarUrl(item) }} 
          style={styles.avatar} 
        />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.mainText}>{main}</Text>
          {sub && <Text style={styles.subText}>{sub}</Text>}
          <Text style={styles.timeText}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const notifications = data?.notifications || [];

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
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
          data-testid="notifications-back-btn"
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Content */}
      {isLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationItemSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
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
    paddingVertical: 12,
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
    paddingTop: 8,
    paddingBottom: 90, // Space for MiniPlayer
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    marginRight: 14,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  mainText: {
    fontSize: 15,
    fontFamily: 'Ubuntu-Medium',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: 'Ubuntu-Regular',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 13,
    color: '#888888',
    fontFamily: 'Ubuntu-Regular',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginLeft: 78, // Avatar width (48) + marginRight (14) + paddingHorizontal (16)
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

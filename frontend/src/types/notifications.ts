export interface NotificationData {
  userId?: string;
  followerId?: string;
  userName?: string;
  userAvatar?: string;
  stationId?: string;
  stationName?: string;
  stationLogo?: string;
  stationSlug?: string;
  station?: any;
}

export interface Notification {
  _id: string;
  type: string;
  read?: boolean;
  fromUserId?: string | { _id: string; fullName?: string; username?: string; avatar?: string; profileImageUrl?: string };
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

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount: number;
}

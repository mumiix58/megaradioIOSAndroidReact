import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import type { Station, FavoritesResponse, User } from '../types';

export const userService = {
  // Get user's favorites
  // Note: API returns Station[] directly, not { favorites: Station[] }
  async getFavorites(): Promise<Station[]> {
    const response = await api.get(API_ENDPOINTS.user.favorites);
    // API returns array directly
    return Array.isArray(response.data) ? response.data : (response.data.favorites || []);
  },

  // Add station to favorites
  async addFavorite(stationId: string): Promise<{ success?: boolean; message?: string; alreadyExists?: boolean }> {
    try {
      const response = await api.post(API_ENDPOINTS.user.favorites, { stationId });
      return response.data;
    } catch (error: any) {
      // "Station already in favorites" is not a real error — treat as success
      if (error?.response?.status === 400 && error?.response?.data?.error === 'Station already in favorites') {
        return { success: true, alreadyExists: true };
      }
      throw error;
    }
  },

  // Remove station from favorites
  async removeFavorite(stationId: string): Promise<{ message: string }> {
    const response = await api.delete(API_ENDPOINTS.user.removeFavorite(stationId));
    return response.data;
  },

  // Check if station is favorited
  async checkFavorite(stationId: string): Promise<{ isFavorited: boolean }> {
    const response = await api.get(API_ENDPOINTS.user.checkFavorite(stationId));
    return response.data;
  },

  // Get recently played stations
  async getRecentlyPlayed(): Promise<Station[]> {
    const response = await api.get(API_ENDPOINTS.recentlyPlayed);
    return response.data;
  },

  // Record recently played
  async recordRecentlyPlayed(stationId: string): Promise<{ message: string }> {
    const response = await api.post(API_ENDPOINTS.recentlyPlayed, { stationId });
    return response.data;
  },

  // Record listening duration
  async recordListening(
    stationId: string,
    duration: number,
    startedAt: string
  ): Promise<void> {
    await api.post(API_ENDPOINTS.listening.record, {
      stationId,
      listenDuration: duration,
    });
  },

  // Get user profile
  async getProfile(idOrSlug: string): Promise<User> {
    const response = await api.get(API_ENDPOINTS.profile(idOrSlug));
    return response.data;
  },

  // Get user's public favorites
  async getUserFavorites(idOrSlug: string): Promise<Station[]> {
    const response = await api.get(API_ENDPOINTS.userFavorites(idOrSlug));
    return response.data;
  },

  // Follow user
  async followUser(userId: string): Promise<{ message: string }> {
    const response = await api.post(API_ENDPOINTS.user.follow(userId));
    return response.data;
  },

  // Unfollow user (backend expects DELETE method)
  async unfollowUser(userId: string): Promise<{ message: string }> {
    const response = await api.delete(API_ENDPOINTS.user.unfollow(userId));
    return response.data;
  },

  // Check if following user
  async isFollowing(userId: string): Promise<{ isFollowing: boolean }> {
    const response = await api.get(API_ENDPOINTS.user.isFollowing(userId));
    return response.data;
  },

  // Get followers
  async getFollowers(userId: string): Promise<User[]> {
    const response = await api.get(API_ENDPOINTS.user.followers(userId));
    return response.data;
  },

  // Get following
  async getFollowing(userId: string): Promise<User[]> {
    const response = await api.get(API_ENDPOINTS.user.following(userId));
    return response.data;
  },

  // Upload avatar
  async uploadAvatar(formData: FormData): Promise<{ success: boolean; avatar: string }> {
    const response = await api.post(API_ENDPOINTS.user.avatar, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Delete avatar
  async deleteAvatar(): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(API_ENDPOINTS.user.avatar);
    return response.data;
  },
};

export default userService;

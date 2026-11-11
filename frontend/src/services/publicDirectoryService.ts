import api from './api';
import { API_ENDPOINTS } from '../constants/api';
export const DIRECTORY_PAGE_SIZE = 100;
export interface PublicDirectoryUser {
  _id: string; name: string; slug?: string; avatar?: string; profileImageUrl?: string;
  profilePhoto?: string; favorites_count?: number; favoriteStationsCount?: number;
  isPublicProfile?: boolean;
}
export interface DirectoryPage { users: PublicDirectoryUser[]; page: number; rawCount: number }
export function normalizeDirectory(data: any): PublicDirectoryUser[] {
  const list = Array.isArray(data) ? data : data?.data || data?.users || [];
  if (!Array.isArray(list)) throw new Error('Invalid public profile response');
  return [...new Map<string, PublicDirectoryUser>(list.filter(user => user?._id && user.isPublicProfile !== false)
    .map(user => [user._id, { ...user, name: user.name || user.fullName || 'User' }])).values()];
}
export async function fetchDirectoryPage(page: number,signal?:AbortSignal): Promise<DirectoryPage> {
  const { data } = await api.get(API_ENDPOINTS.publicProfiles, { params: { page, limit: DIRECTORY_PAGE_SIZE },signal,timeout:8000 });
  const raw = Array.isArray(data) ? data : data?.data || data?.users || [];
  return { users: normalizeDirectory(data), page, rawCount: Array.isArray(raw) ? raw.length : 0 };
}
export function nextDirectoryPage(last: DirectoryPage, pages: DirectoryPage[]): number | undefined {
  if (last.rawCount < DIRECTORY_PAGE_SIZE) return undefined;
  const previous = new Set(pages.slice(0, -1).flatMap(page => page.users.map(user => user._id)));
  if (!last.users.some(user => !previous.has(user._id))) return undefined;
  return last.page + 1;
}
export function mergeDirectoryPages(pages: DirectoryPage[]): PublicDirectoryUser[] {
  return [...new Map(pages.flatMap(page => page.users.map(user => [user._id, user] as const))).values()];
}
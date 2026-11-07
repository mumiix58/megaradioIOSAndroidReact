import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';

// Revocations survive offline logout, in the same secure storage as the session.
const KEY = 'megaradio_pending_revocations';
let work: Promise<void> = Promise.resolve();
async function read(): Promise<string[]> {
  const raw = Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : [];
}
async function write(tokens: string[]) {
  if (Platform.OS === 'web') {
    if (tokens.length) localStorage.setItem(KEY, JSON.stringify(tokens)); else localStorage.removeItem(KEY);
  } else if (tokens.length) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(KEY);
}
export function revokeSession(token?: string | null): Promise<void> {
  work = work.catch(() => {}).then(async () => {
    const pending = [...new Set([...(await read()), ...(token ? [token] : [])])];
    await write(pending);
    const remaining = [...pending];
    for (const value of pending) {
      try {
        await axios.post(`${API_BASE_URL}/api/auth/mobile/logout`, {}, {
          timeout: 5000, withCredentials: false,
          headers: { Authorization: `Bearer ${value}`, 'X-MegaRadio-Platform': Platform.OS },
        });
        remaining.splice(remaining.indexOf(value), 1);
        await write(remaining);
      } catch (error: any) {
        // An already revoked/expired token must not block later logout jobs.
        if (error.response?.status !== 401) break;
        remaining.splice(remaining.indexOf(value), 1);
        await write(remaining);
      }
    }
  });
  return work;
}

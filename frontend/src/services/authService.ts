import api from './api';
import { API_ENDPOINTS } from '../constants/api';
import { useAuthStore } from '../store/authStore';
import type { User, AuthResponse, AuthCheckResponse } from '../types';

const API_BASE = 'https://api.themegaradio.com';

// Extended response types for mobile
interface MobileLoginResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
}

interface GoogleLoginParams {
  googleId: string;
  email: string;
  fullName: string;
  avatar?: string;
}

// All native entry points persist the same user and token shape.
function mobileAuthResponse(data: any): MobileLoginResponse {
  const id = data?.user?._id || data?.user?.id;
  if (data?.success === false || typeof data?.token !== 'string' || !data.token || !id) {
    throw new Error(data?.error || data?.message || 'Invalid authentication response from server');
  }
  return {
    success: true,
    token: data.token,
    user: { ...data.user, _id: id, id, name: data.user.fullName || data.user.name || '' },
    message: data.message,
  };
}

export function authErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.error || error?.response?.data?.message || error?.message || fallback;
}

export const authService = {
  // ─── WEB AUTH (Session-based) ───

  // Sign up new user
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const response = await api.post(API_ENDPOINTS.auth.signup, {
      email,
      password,
      fullName: name,
      username,
    });
    return response.data;
  },

  // Login user (web session)
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await api.post(API_ENDPOINTS.auth.login, {
      email,
      password,
    });
    return response.data;
  },

  // Logout user
  async logout(): Promise<{ message: string }> {
    const response = await api.post(API_ENDPOINTS.auth.logout);
    return response.data;
  },

  // Check authentication status
  async checkAuth(): Promise<AuthCheckResponse> {
    const response = await api.get(API_ENDPOINTS.auth.me);
    return response.data;
  },

  // Update user profile
  async updateProfile(data: { name?: string; isPublicProfile?: boolean }): Promise<{ user: User }> {
    const response = await api.put(API_ENDPOINTS.auth.profile, data);
    return response.data;
  },

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post(API_ENDPOINTS.auth.forgotPassword, { email });
    return response.data;
  },

  // Reset password
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await api.post(API_ENDPOINTS.auth.resetPassword, {
      token,
      password,
    });
    return response.data;
  },

  // ─── MOBILE AUTH (Token-based) ───

  /**
   * Mobile Login with Email/Password
   * For native: POST /api/auth/mobile/login (returns token)
   * For web: POST /api/auth/login + response includes user data
   */
  async mobileLogin(email: string, password: string): Promise<MobileLoginResponse> {
    const { deviceInfo } = useAuthStore.getState();
    const response = await api.post(`${API_BASE}/api/auth/mobile/login`, {
      email: email.trim(),
      password,
      // The token contract is mobile even on iPad/web preview.
      deviceType: 'mobile',
      deviceName: deviceInfo.deviceName || 'Mobile Device',
    });
    return mobileAuthResponse(response.data);
  },

  /**
   * Mobile Login with Google
   * POST /api/auth/mobile/google
   */
  async mobileGoogleLogin(params: GoogleLoginParams): Promise<MobileLoginResponse> {
    const { deviceInfo } = useAuthStore.getState();
    
    const response = await api.post(`${API_BASE}/api/auth/mobile/google`, {
      ...params, deviceType: 'mobile', deviceName: deviceInfo.deviceName || 'Mobile Device',
    });
    return mobileAuthResponse(response.data);
  },

  /**
   * Check mobile auth status
   * GET /api/auth/mobile/me
   */
  async mobileCheckAuth(): Promise<{ authenticated: boolean; user?: User }> {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      return { authenticated: false };
    }
    
    try {
      const response = await api.get(`${API_BASE}/api/auth/mobile/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      return {
        authenticated: response.data.authenticated || false,
        user: response.data.user,
      };
    } catch (error: any) {
      if (error.response?.status === 401) return { authenticated: false };
      throw error;
    }
  },

  /**
   * Mobile logout (single device)
   * POST /api/auth/mobile/logout
   */
  async mobileLogout(): Promise<void> {
    const { token } = useAuthStore.getState();
    
    if (!token) return;
    
    try {
      await api.post(
        `${API_BASE}/api/auth/mobile/logout`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error('Mobile logout error:', error);
    }
  },

  /**
   * Mobile logout from all devices
   * POST /api/auth/mobile/logout-all
   */
  async mobileLogoutAll(): Promise<void> {
    const { token } = useAuthStore.getState();
    
    if (!token) return;
    
    try {
      await api.post(
        `${API_BASE}/api/auth/mobile/logout-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error('Mobile logout-all error:', error);
    }
  },

  /**
   * Mobile register
   * Uses web signup endpoint as mobile-specific register may not exist
   * POST /api/auth/signup then auto-login via mobile endpoint
   */
  async mobileRegister(
    email: string,
    password: string,
    fullName: string
  ): Promise<MobileLoginResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    // Signup has no username field in the UI. Keep the generated name within
    // the server's 3–30 character limit and avoid clashes across email domains.
    const base = normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'user';
    const username = `${base}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await api.post(`${API_BASE}/api/auth/signup`, {
      email: normalizedEmail,
      password,
      fullName: fullName.trim(),
      username,
    });
    return this.mobileLogin(normalizedEmail, password);
  },

  // ─── SOCIAL LOGIN (Mobile) ───

  /**
   * Google Sign-In (POST-based mobile flow)
   * POST /api/auth/google
   * 
   * Backend verifies idToken with Google and creates/returns user + JWT token.
   * Required: idToken (from Google SDK)
   * Optional: email, name, googleId, platform
   */
  async googleSignIn(
    idToken: string,
    userInfo?: { email?: string; name?: string; googleId?: string }
  ): Promise<MobileLoginResponse> {
    const response = await api.post(`${API_BASE}/api/auth/google`, {
      idToken,
      email: userInfo?.email,
      name: userInfo?.name,
      googleId: userInfo?.googleId,
      platform: 'mobile',
    });
    return mobileAuthResponse(response.data);
  },

  /**
   * Apple Sign-In (POST-based mobile flow)
   * POST /api/auth/apple
   * 
   * Backend verifies identityToken with Apple JWKS and creates/returns user + JWT token.
   * Required: identityToken (from Apple SDK)
   * Optional: authorizationCode, fullName, email, user, platform
   * 
   * IMPORTANT: Apple provides fullName and email ONLY on first sign-in.
   * Subsequent sign-ins will have null for these fields.
   */
  async appleSignIn(
    identityToken: string,
    authorizationCode: string,
    fullName?: { givenName?: string | null; familyName?: string | null } | null,
    email?: string | null,
    appleUserId?: string
  ): Promise<MobileLoginResponse> {
    const response = await api.post(`${API_BASE}/api/auth/apple`, {
      identityToken,
      authorizationCode,
      fullName: fullName || undefined,
      email: email || undefined,
      user: appleUserId || undefined,
      platform: 'mobile',
    });
    return mobileAuthResponse(response.data);
  },
};

export default authService;

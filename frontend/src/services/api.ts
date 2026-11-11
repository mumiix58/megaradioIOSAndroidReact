import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { isGlobalCountry } from '../utils/countryScope';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';

// MegaRadio Internal API Key - unlimited, no rate limiting
const MEGARADIO_API_KEY = 'mr_VUzdIUHuXaagvWUC208Vzi_3lqEV1Vzw';

// For web preview, we cannot use credentials due to CORS
// Native apps will handle cookies differently
const isWeb = Platform.OS === 'web';

// Create axios instance with API key and cookie support
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': MEGARADIO_API_KEY,
  },
  // Only use credentials on native platforms where CORS isn't an issue
  withCredentials: !isWeb,
});

// Helper to get auth token (lazy import to avoid circular dependency)
const getAuthToken = (): string | null => {
  try {
    // Dynamic import of authStore to avoid circular dependency
    const { useAuthStore } = require('../store/authStore');
    const token = useAuthStore.getState().token;
    return token;
  } catch (err) {
    return null;
  }
};

// Request interceptor - Add tv=1 param to ALL requests for optimized responses
// This reduces response size by ~85% (18KB -> 2.5KB per station)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (__DEV__ && isWeb && API_BASE_URL === '/__preview-api' && config.url?.startsWith('https://api.themegaradio.com/')) {
      config.url = config.url.slice('https://api.themegaradio.com'.length);
    }
    // Ensure API key is always present
    if (config.headers) {
      config.headers['X-API-Key'] = MEGARADIO_API_KEY;
      
      // Add X-Device-Type header ONLY for native platforms (not web)
      // Web preview has CORS restrictions that don't allow custom headers
      if (!isWeb) {
        config.headers['X-Device-Type'] = 'mobile';
      }
      
      // Add mobile auth token if available and not already set
      const token = getAuthToken();
      if (token && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    // Add tv=1 parameter to ALL requests for optimized mobile/TV responses
    // This returns only essential fields (name, slug, url, favicon, country, votes etc.)
    config.params = { ...config.params, tv: 1 };
    for (const field of ['country', 'countryCode', 'countrycode']) {
      if (isGlobalCountry(config.params[field])) delete config.params[field];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry for 429
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error.config;
    // Retry on 429 (rate limit) - max 2 retries with delay
    if (config && error.response?.status === 429 && !((config.method || 'get').toLowerCase() !== 'get' && config.url?.startsWith('/api/messages/')) && (!config._retryCount || config._retryCount < 2)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delay = config._retryCount * 1500; // 1.5s, 3s
      await new Promise(r => setTimeout(r, delay));
      return api(config);
    }
    // Handle 401 unauthorized globally
    if (error.response?.status === 401) {
      console.log('Unauthorized - session may have expired');
    }
    return Promise.reject(error);
  }
);

export default api;

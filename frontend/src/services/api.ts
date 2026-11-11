import {isGlobalCountry} from '../utils/countryScope';
import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import { beginSessionRequest, isCurrentSession, sessionVersion } from './sessionRuntime';

type SessionConfig = InternalAxiosRequestConfig & {
  sessionVersion?: number;
  releaseSessionRequest?: () => void;
  sessionToken?: string | null;
  _retryCount?: number;
  performanceTrace?: Promise<any | null>;
};

function stopPerformanceTrace(config: SessionConfig | undefined, status: number): void {
  void config?.performanceTrace?.then(trace => {
    if (!trace) return;
    trace.putAttribute('status', String(status));
    return trace.stop();
  }).catch(() => {});
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // RN maps false to HTTPShouldHandleCookies=false / CookieJar.NO_COOKIES.
  withCredentials: false,
});

api.interceptors.request.use((config: SessionConfig) => {
  if(__DEV__&&Platform.OS==='web'&&API_BASE_URL==='/__preview-api'&&config.url?.startsWith('https://api.themegaradio.com/'))config.url=config.url.slice('https://api.themegaradio.com'.length);
  const productBase=new URL(API_BASE_URL,'https://api.themegaradio.com');
  const target = new URL(config.url || '', productBase);
  if (target.origin !== productBase.origin) {
    throw new Error('The product API client only accepts the product API origin.');
  }
  if (config.sessionVersion !== undefined && !isCurrentSession(config.sessionVersion)) {
    throw new axios.CanceledError('Session changed');
  }
  const { useAuthStore } = require('../store/authStore');
  const token = useAuthStore.getState().token;
  config.headers = AxiosHeaders.from(config.headers);
  config.headers.delete('Cookie');
  config.headers.delete('X-API-Key');
  config.headers.delete('X-Device-Type');
  config.headers.set('X-MegaRadio-Platform', Platform.OS === 'web' ? 'web' : Platform.OS);
  const publicAuth = /\/api\/auth\/(?:mobile\/)?(?:login|signup|google|apple|forgot-password|reset-password)$/.test(target.pathname);
  if (publicAuth) config.headers.delete('Authorization');
  if (!publicAuth && !config.headers.has('Authorization') && token) config.headers.set('Authorization', `Bearer ${token}`);
  config.withCredentials = false;
  config.sessionToken = token && config.headers.get('Authorization') === `Bearer ${token}` ? token : null;
  config.sessionVersion = sessionVersion();
  const request = beginSessionRequest(config.signal as AbortSignal | undefined);
  config.signal = request.signal;
  config.releaseSessionRequest = request.release;
  if (!config.method || config.method === 'get') config.params = { ...config.params, tv: 1 };
  for(const field of ['country','countryCode','countrycode']){if(config.params&&isGlobalCountry(config.params[field]))delete config.params[field];}
  try {
    config.performanceTrace = require('./firebaseRuntimeService').startApiPerformanceTrace((config.method || 'get').toUpperCase());
  } catch { /* Older binaries do not have Performance installed. */ }
  return config;
});

api.interceptors.response.use(
  response => {
    const config = response.config as SessionConfig;
    config.releaseSessionRequest?.();
    stopPerformanceTrace(config, response.status);
    if (!isCurrentSession(config.sessionVersion!)) throw new axios.CanceledError('Session changed');
    return response;
  },
  async error => {
    const config = error.config as SessionConfig | undefined;
    config?.releaseSessionRequest?.();
    stopPerformanceTrace(config, error.response?.status || 0);
    if (config?.sessionVersion !== undefined && !isCurrentSession(config.sessionVersion)) {
      throw new axios.CanceledError('Session changed');
    }
    if (config?.sessionToken && error.response?.status === 401) {
      const { useAuthStore } = require('../store/authStore');
      void useAuthStore.getState().expireSession(config.sessionToken);
    }
    // Never automatically replay listening, payment or other mutations.
    if (config?.method === 'get' && error.response?.status === 429 && (config._retryCount || 0) < 2) {
      config._retryCount = (config._retryCount || 0) + 1;
      await new Promise(resolve => setTimeout(resolve, config._retryCount! * 1500));
      return api(config);
    }
    return Promise.reject(error);
  },
);
export default api;

import axios from 'axios';
import { tokenStorage } from '@/services/storage/tokenStorage';
import { globalLoading } from '@/shared/utils/globalLoading';
import './axios.d';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

const shouldSkipGlobalLoading = (config: {
  method?: string;
  skipGlobalLoading?: boolean;
}) => {
  if (config.skipGlobalLoading === true) return true;
  if (config.skipGlobalLoading === false) return false;
  // GET mặc định không bật overlay — trang dùng Spin/table loading riêng; tránh nhấp nháy khi search/poll.
  const method = (config.method || 'get').toLowerCase();
  return method === 'get' || method === 'head';
};

const trackGlobalLoadingStart = (config: {
  method?: string;
  skipGlobalLoading?: boolean;
  __globalLoadingTracked?: boolean;
}) => {
  if (shouldSkipGlobalLoading(config)) return;
  globalLoading.start();
  config.__globalLoadingTracked = true;
};

const trackGlobalLoadingEnd = (config?: { __globalLoadingTracked?: boolean } | null) => {
  if (!config?.__globalLoadingTracked) return;
  config.__globalLoadingTracked = false;
  globalLoading.end();
};

axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    trackGlobalLoadingStart(config);
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => {
    trackGlobalLoadingEnd(response.config);
    return response;
  },
  async (error) => {
    trackGlobalLoadingEnd(error.config);

    const originalRequest = error.config;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url ?? '';
    if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      tokenStorage.clear();
      if (!window.location.pathname.startsWith('/auth/login')) {
        window.location.href = '/auth/login';
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = data.data;
      tokenStorage.setTokens(accessToken, newRefreshToken);
      processQueue(null, accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      tokenStorage.clear();
      if (!window.location.pathname.startsWith('/auth/login')) {
        window.location.href = '/auth/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

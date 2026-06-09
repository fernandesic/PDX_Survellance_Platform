import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios"
import { logger } from "@/utils/logger";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL && import.meta.env.PROD) {
  logger.error('[API] VITE_API_BASE_URL is not configured. API calls will fail.');
}


interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface ApiError {
  message: string;
  detail?: string;
  status: number;
  isNetworkError?: boolean;
  data?: unknown;
}


const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  withCredentials: true,      // ← Send httpOnly cookies on every request
  headers: {
    'Content-Type': 'application/json',
  },
});


/**
 * TokenManager — httpOnly cookie wrapper.
 *
 * Tokens are stored as httpOnly cookies (set by the backend).
 * JavaScript cannot read them — the browser sends them automatically.
 *
 * The methods below exist ONLY for backward cleanup:
 * - clearTokens() removes any leftover localStorage entries from before the migration.
 * - setTokens() is a no-op (backend sets cookies).
 * - getAccessToken() / getRefreshToken() return null (cookies are invisible to JS).
 */
class TokenManager {
  private static ACCESS_TOKEN_KEY = 'access_token';
  private static REFRESH_TOKEN_KEY = 'refresh_token';

  private static getSessionKey(baseKey: string): string {
    if (typeof window === 'undefined') return baseKey;
    const sessionId = localStorage.getItem('browser_session_id');
    return sessionId ? `${baseKey}_${sessionId}` : baseKey;
  }

  /**
   * Returns null — access token is now in an httpOnly cookie (invisible to JS).
   * The browser sends it automatically via withCredentials.
   */
  static getAccessToken(): string | null {
    return null;
  }

  /**
   * Returns null — refresh token is now in an httpOnly cookie.
   */
  static getRefreshToken(): string | null {
    return null;
  }

  /**
   * No-op — tokens are set as httpOnly cookies by the backend.
   * Kept for API compatibility.
   */
  static setTokens(_tokens: AuthTokens): void {
    // No-op: backend sets httpOnly cookies on login/refresh responses
  }

  /**
   * Clear any leftover localStorage entries from before the migration,
   * and clear the user profile data.
   */
  static clearTokens(): void {
    if (typeof window === 'undefined') return;

    // Clean up legacy localStorage entries
    const accessKey = this.getSessionKey(this.ACCESS_TOKEN_KEY);
    const refreshKey = this.getSessionKey(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(accessKey);
    localStorage.removeItem(refreshKey);

    // Also clean base keys (no session suffix)
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);

    localStorage.removeItem('browser_session_id');
    localStorage.removeItem('whodatarepruser');
  }

  /**
   * Check if the user is likely authenticated.
   * Since we can't read httpOnly cookies, we check for the user profile
   * in localStorage as a proxy signal. The real auth check happens
   * server-side when cookies are sent.
   */
  static isLikelyAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('whodatarepruser') !== null;
  }
}


let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });

  failedQueue = [];
};


// Request interceptor — injects X-Tenant-ID header for super-admin tenant switching.
// Auth cookies are sent automatically via withCredentials: true.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If a super admin has selected a specific tenant to view as,
    // send it as X-Tenant-ID so the backend TenantMiddleware can override.
    const activeTenantId = localStorage.getItem('who_active_tenant_id');
    if (activeTenantId) {
      config.headers.set('X-Tenant-ID', activeTenantId);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);


api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // gracefully ignore 403 forbidden for background endpoints so they don't wipe tokens for restricted roles
    if (error.response?.status === 403) {
      const url = originalRequest.url || '';
      if (
        url.includes('/account/news') ||
        url.includes('/account/alerts') ||
        url.includes('signals/') ||
        url.includes('detections/')
      ) {
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Cookie was refreshed server-side, just retry
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // POST to refresh endpoint — the refresh_token cookie is sent
        // automatically by the browser (withCredentials: true).
        // The backend reads it from the cookie and sets new cookies.
        await axios.post(
          `${API_BASE_URL}/account/auth/token/refresh`,
          {},                    // empty body — token is in cookie
          { withCredentials: true }
        );

        processQueue(null);

        // Retry the original request — new access_token cookie is set
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError);
        TokenManager.clearTokens();
        redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);


const redirectToLogin = () => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;

    // Don't redirect if already on login or on public pages
    if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/preparedness-form") || window.location.pathname.startsWith("/supplierForm") || window.location.pathname.startsWith("/sitrep-form")) {
      return;
    }

    const loginUrl = `/login?next=${encodeURIComponent(currentPath)}`;
    window.location.href = loginUrl;
  }
};


export class ApiConsumer {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default; bodies are typed
  static async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await api.get<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default
  static async post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await api.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default
  static async put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await api.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default
  static async patch<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await api.patch<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default
  static async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await api.delete<T>(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-supplied generic default
  static async upload<T = any>(url: string, file: File | FormData, onProgress?: (progress: number) => void): Promise<T> {
    try {
      const formData = file instanceof FormData ? file : new FormData();
      if (file instanceof File) {
        formData.append('file', file);
      }

      const response = await api.post<T>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  static async download(url: string, filename?: string): Promise<void> {
    try {
      const response = await api.get(url, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }


  private static handleError(error: AxiosError): ApiError {
    if (error.response) {
      const data = error.response.data as { message?: string; detail?: string } | undefined;
      return {
        message: data?.message || data?.detail || error.message,
        detail: data?.detail,
        status: error.response.status,
        isNetworkError: false,
        data,
      };
    } else if (error.request) {
      return {
        message: 'Network error - no response received',
        status: 0,
        isNetworkError: true,
      };
    } else {
      return {
        message: error.message,
        status: 0,
        isNetworkError: true,
      };
    }
  }
}


export { TokenManager };


export { api };


export const apiGet = ApiConsumer.get.bind(ApiConsumer);
export const apiPost = ApiConsumer.post.bind(ApiConsumer);
export const apiPut = ApiConsumer.put.bind(ApiConsumer);
export const apiPatch = ApiConsumer.patch.bind(ApiConsumer);
export const apiDelete = ApiConsumer.delete.bind(ApiConsumer);
export const apiUpload = ApiConsumer.upload.bind(ApiConsumer);
export const apiDownload = ApiConsumer.download.bind(ApiConsumer);
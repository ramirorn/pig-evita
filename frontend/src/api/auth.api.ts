// ===========================================
// Auth API
// ===========================================
import apiClient, { setTokens, clearTokens } from './client';
import type { AuthResponse, RefreshResponse } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  /** Login with email and password */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  /** Refresh access token */
  async refresh(): Promise<RefreshResponse> {
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh');
    return data;
  },

  /** Logout and invalidate refresh token */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  /** Get current authenticated user */
  async me(): Promise<{ id: string; email: string; role: string }> {
    const { data } = await apiClient.post('/auth/me');
    return data;
  },
};

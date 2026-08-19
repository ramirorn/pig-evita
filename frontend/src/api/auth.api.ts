// ===========================================
// Auth API
// ===========================================
import apiClient, { setAccessToken, clearAccessToken } from './client';
import type { AuthResponse, AuthUserProfile, RefreshResponse } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  /**
   * Login. El access token queda en memoria; el refresh token viaja en una
   * cookie httpOnly que el navegador guarda solo (nunca pasa por JavaScript).
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    setAccessToken(data.accessToken);
    return data;
  },

  /**
   * Renueva el access token usando la cookie httpOnly.
   *
   * Se usa al arrancar la app para recuperar la sesión tras un reload (el token
   * en memoria se pierde). Los 401 de otras requests los resuelve el
   * interceptor de `client.ts`, que deduplica los refresh concurrentes.
   */
  async refresh(): Promise<RefreshResponse> {
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh');
    setAccessToken(data.accessToken);
    return data;
  },

  /** Logout: invalida el refresh token en el server y borra la cookie. */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAccessToken();
    }
  },

  /** Perfil del usuario autenticado (fuente de verdad para rehidratar sesión). */
  async me(): Promise<AuthUserProfile> {
    const { data } = await apiClient.get<AuthUserProfile>('/auth/me');
    return data;
  },
};

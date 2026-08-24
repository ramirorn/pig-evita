// ===========================================
// Auth API
// ===========================================
import apiClient, { setAccessToken, clearAccessToken, refreshAccessToken } from './client';
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
   * en memoria se pierde).
   *
   * Delega en el `refreshAccessToken()` de `client.ts` en vez de hacer su
   * propio `POST /auth/refresh` (hallazgo R19): el backend rota el refresh
   * token, así que si esta llamada y un 401 concurrente pedían cada una por su
   * lado, la segunda llegaba con un token ya consumido. Pasando por el
   * single-flight, arranque e interceptor comparten la misma promesa y el
   * endpoint se llama una sola vez. El token también lo guarda esa función.
   */
  async refresh(): Promise<RefreshResponse> {
    const accessToken = await refreshAccessToken();
    return { accessToken };
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

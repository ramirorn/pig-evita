// ===========================================
// Axios Client — Centralized HTTP Client
// ===========================================
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  // Necesario para que el navegador mande la cookie httpOnly del refresh token.
  withCredentials: true,
});

// ============ ACCESS TOKEN (SÓLO EN MEMORIA) ============

/**
 * El access token vive en una variable de módulo, nunca en `localStorage`
 * (hallazgo C-03).
 *
 * Con el token en `localStorage`, cualquier XSS podía leerlo y quedarse con la
 * sesión. En memoria muere con la pestaña; el precio es que al recargar la
 * página hay que pedir uno nuevo, y para eso está la cookie httpOnly del
 * refresh token, que JavaScript no puede leer (ver `auth.store.tsx`).
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/**
 * Borra los restos del esquema anterior.
 *
 * Las sesiones abiertas antes de este cambio dejaron el access token, el refresh
 * token y el objeto `user` en `localStorage`. Ya no se leen, pero seguirían ahí
 * hasta que el usuario limpie el navegador — y un refresh token olvidado sigue
 * siendo un secreto expuesto a cualquier XSS. Se puede eliminar esta función
 * después de un ciclo de release.
 */
function purgeLegacyAuthStorage(): void {
  try {
    for (const key of ['evita_access_token', 'evita_refresh_token', 'evita_user']) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage inaccesible (modo privado, SSR): nada que limpiar.
  }
}

purgeLegacyAuthStorage();

// ============ REQUEST INTERCEPTOR ============

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ============ REFRESH SINGLETON ============

/**
 * Promesa única de refresh en vuelo.
 *
 * Reemplaza al par `isRefreshing` + `failedQueue` (hallazgo A-03): con aquel
 * esquema, N requests que fallaban con 401 a la vez podían disparar más de una
 * llamada a `/auth/refresh`, y como el backend **rota** el refresh token, la
 * segunda llegaba con un token ya consumido y cerraba la sesión por seguridad.
 *
 * Ahora todas las requests concurrentes esperan a la misma promesa: una sola
 * llamada a `/auth/refresh` por ráfaga de 401.
 */
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, null, {
      withCredentials: true, // manda la cookie httpOnly
    })
    .then((response) => {
      // La respuesta viene envuelta por el interceptor del backend
      // (`{ success, data }`) sólo si pasa por `apiClient`; acá usamos `axios`
      // pelado a propósito, para no reentrar en este mismo interceptor.
      const data = response.data as { accessToken: string } & {
        data?: { accessToken: string };
      };
      const token = data.data?.accessToken ?? data.accessToken;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/** Sesión no recuperable: se limpia el token y se saca al usuario del admin. */
function handleSessionExpired(): void {
  clearAccessToken();
  if (window.location.pathname.startsWith('/admin')) {
    window.location.href = '/admin/login';
  }
}

// ============ RESPONSE INTERCEPTOR ============

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap the NestJS `{ success: true, data: ..., meta?: ... }` response structure
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      if ('meta' in response.data) {
        response.data = { data: response.data.data, meta: response.data.meta };
      } else {
        response.data = response.data.data;
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    // 401 en una request normal: intentar renovar el access token una vez.
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const token = await refreshAccessToken();

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        handleSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;

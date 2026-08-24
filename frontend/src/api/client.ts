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

/**
 * Único camino del frontend hacia `POST /auth/refresh` (hallazgo R19).
 *
 * Se exporta para que `auth.api.ts` la use en lugar de disparar su propia
 * request: el backend **rota** el refresh token, así que dos caminos
 * independientes al endpoint son exactamente la condición que este
 * single-flight vino a cerrar. Si el arranque de la app (`restoreSession()`) y
 * un 401 concurrente pedían cada uno por su lado, el segundo llegaba con un
 * token ya consumido y el backend cerraba la sesión.
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= axios
    .post<{ accessToken: string }>(`${API_BASE_URL}/auth/refresh`, null, {
      withCredentials: true, // manda la cookie httpOnly
    })
    .then((response) => {
      // La respuesta viene envuelta por el interceptor del backend
      // (`{ success, data }`) sólo si pasa por `apiClient`; acá usamos `axios`
      // pelado a propósito, para no reentrar en este mismo interceptor.
      const data = response.data as Partial<{ accessToken: string }> & {
        data?: Partial<{ accessToken: string }>;
      };
      const token = data.data?.accessToken ?? data.accessToken;

      // El tipo dice `string`, pero es la palabra del backend: si la respuesta
      // no trae el campo en ninguna de las dos formas, guardar `undefined`
      // dejaba la promesa resuelta "con éxito" y el reintento salía con
      // `Bearer undefined` (hallazgo R24). Ese 401 ya no dispara el refresh
      // porque `_retry` está en `true`, así que el usuario quedaba con una
      // sesión zombie: sin token y sin logout. Un 200 sin token es una
      // respuesta inservible; se trata como fallo y termina en logout limpio.
      if (typeof token !== 'string' || token === '') {
        throw new Error('La respuesta de /auth/refresh no trajo un access token válido');
      }

      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ============ AVISO DE SESIÓN EXPIRADA ============

type SessionExpiredListener = () => void;

const sessionExpiredListeners = new Set<SessionExpiredListener>();

/**
 * Suscribe un callback al evento "la sesión ya no se puede recuperar".
 *
 * `handleSessionExpired` vive fuera del árbol de React y por eso no podía tocar
 * el estado del `AuthProvider` (hallazgo R25). Dentro de `/admin` no se notaba
 * —el `window.location.href` recarga la página y con eso se va todo— pero
 * **fuera** de `/admin` sólo se borraba el token: el store seguía con `user`
 * poblado e `isAuthenticated` en `true`, así que volver al admin con el router
 * (sin recarga) pasaba `ProtectedRoute` con un usuario fantasma y cada query
 * rebotaba en 401. Con esta suscripción el store se entera y suelta el usuario.
 *
 * Devuelve la función para desuscribirse (pensada para el cleanup de un
 * `useEffect`).
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** Sesión no recuperable: se limpia el token y se saca al usuario del admin. */
function handleSessionExpired(): void {
  clearAccessToken();

  // Avisar siempre, también antes del redirect: si la navegación se demora o
  // no ocurre, el estado de React igual queda consistente con el token vacío.
  for (const listener of sessionExpiredListeners) {
    listener();
  }

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
    // `error.config` es opcional en Axios (un error de red disparado antes de
    // armar la request no lo trae), y el tipo lo decía a medias: `:196` usaba
    // `originalRequest?.url` pero `:200` accedía a `._retry` sin guard. La
    // inconsistencia sugería que uno de los dos estaba mal; el que estaba mal
    // era el segundo. Con el `| undefined` explícito, TypeScript obliga a
    // decidir, y la decisión correcta es no reintentar lo que no se puede
    // reintentar: sin `config` no hay request que reenviar (R31).
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    // 401 en una request normal: intentar renovar el access token una vez.
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
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

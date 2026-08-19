// ===========================================
// Auth Store — React Context
// ===========================================
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authApi, type LoginPayload } from '@/api/auth.api';
import { clearAccessToken } from '@/api/client';
import { resetQueryCache } from '@/lib/queryClient';
import { type AuthUserProfile, type UserRole } from '@/types';

// ============ TYPES ============

type AuthUser = AuthUserProfile;

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

// ============ CONTEXT ============

const AuthContext = createContext<AuthState | undefined>(undefined);

// ============ PROVIDER ============

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  /**
   * Rehidratación de la sesión al arrancar.
   *
   * Nada de esto sale de `localStorage` (hallazgos C-03 y F17): el access token
   * vive en memoria y se pierde al recargar, así que se pide uno nuevo con la
   * cookie httpOnly del refresh token, y recién entonces se traen los datos del
   * usuario desde `/auth/me`. El servidor es la única fuente de verdad sobre
   * quién está logueado y con qué rol.
   *
   * Para un visitante anónimo esto es una sola request que falla con 401/403 y
   * deja `user` en null.
   */
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await authApi.refresh();
        const profile = await authApi.me();
        if (!cancelled) setUser(profile);
      } catch {
        // Sin cookie válida: sesión anónima.
        clearAccessToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authApi.login(payload);

    // Cubre el caso en que la sesión anterior terminó sin pasar por logout
    // (token vencido, refresh fallido): la cache podría tener datos del usuario
    // anterior y este login los heredaría.
    await resetQueryCache();

    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Vaciar la cache ANTES de soltar el usuario: si el usuario B loguea en el
      // mismo navegador, no debe ver nada de A (hallazgo F3). Va en el `finally`
      // para que también se limpie si la request de logout falla.
      await resetQueryCache();
      clearAccessToken();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============ HOOK ============

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

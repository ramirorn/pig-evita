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
import { getAccessToken, clearTokens } from '@/api/client';
import { resetQueryCache } from '@/lib/queryClient';
import { type UserRole } from '@/types';

// ============ TYPES ============

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

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

const USER_STORAGE_KEY = 'evita_user';

// ============ PROVIDER ============

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!getAccessToken();

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = getAccessToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const me = await authApi.me();
        // Restore full user from stored data, update role from server
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser({ ...parsed, role: me.role as UserRole });
        }
      } catch {
        // Token invalid, clear session
        clearTokens();
        localStorage.removeItem(USER_STORAGE_KEY);
        await resetQueryCache();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await authApi.login(payload);

    // Cubre el caso en que la sesión anterior terminó sin pasar por logout
    // (token vencido, refresh fallido): la cache podría tener datos del usuario
    // anterior y este login los heredaría.
    await resetQueryCache();

    const authUser: AuthUser = {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
      role: response.user.role,
    };
    setUser(authUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Vaciar la cache ANTES de soltar el usuario: si el usuario B loguea en el
      // mismo navegador, no debe ver nada de A (hallazgo F3). Va en el `finally`
      // para que también se limpie si la request de logout falla.
      await resetQueryCache();
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
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

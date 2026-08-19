// ===========================================
// Protected Route Component
// ===========================================
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/store/auth.store';
import { ROUTES } from '@/lib/constants';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Roles habilitados para esta ruta. **Obligatorio** (hallazgo F8): antes era
   * opcional y, sin valor, la ruta quedaba abierta a cualquier usuario
   * autenticado. El backend igual respondía 403, pero la pantalla era alcanzable
   * y cada intento dejaba un error en los logs.
   *
   * Los grupos viven en `@/lib/roles`, espejados de los `@Roles(...)` del backend.
   */
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-primary-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="card p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-destructive-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-primary-900 mb-2">Acceso Denegado</h2>
          <p className="text-primary-600">No tenés permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

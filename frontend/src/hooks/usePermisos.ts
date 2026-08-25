// ===========================================
// usePermisos — permisos por acción del usuario logueado (R22)
// ===========================================
import { useCallback } from 'react';
import { useAuth } from '@/store/auth.store';
import { puedeAccion, type AccionProtegida } from '@/lib/adminActions';
import { puedeFiltrarPorDepartamento } from '@/lib/adminScope';

/**
 * Devuelve `puede('ACCION')` para el rol de la sesión.
 *
 * La forma de función (y no un objeto con todas las acciones) es a propósito:
 * en el punto de uso se lee `puede('TEAM_DELETE') && <Button/>`, que es
 * exactamente la pregunta que el backend va a responder cuando el botón se
 * apriete.
 */
export function usePermisos() {
  const { user } = useAuth();
  const role = user?.role;

  const puede = useCallback(
    (accion: AccionProtegida) => puedeAccion(role, accion),
    [role],
  );

  return {
    puede,
    /** R05: los roles acotados no ven el filtro de departamento. */
    puedeFiltrarPorDepartamento: puedeFiltrarPorDepartamento(role),
  };
}

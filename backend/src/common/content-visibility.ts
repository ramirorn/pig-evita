// ===========================================
// Visibilidad de contenido editorial (R06)
// ===========================================
import { ADMIN_ROLES, Role } from './constants';

/** Forma mínima del payload del JWT que hace falta para decidir visibilidad. */
export interface UsuarioConRol {
  role?: Role | string;
}

/**
 * ¿Este request puede ver contenido sin publicar (borradores)?
 *
 * Es `true` sólo para los roles que administran noticias y calendario —los
 * mismos que pueden crearlas y editarlas, `ADMIN_ROLES`—. Un request anónimo
 * (`user` en null/undefined, que es lo que deja `OptionalJwtAuthGuard` cuando
 * no hay token) es siempre `false`.
 *
 * Está en un solo lugar a propósito: si mañana cambia quién edita contenido,
 * cambia acá y no en cuatro handlers que podrían quedar desincronizados.
 */
export function puedeVerBorradores(
  user: UsuarioConRol | null | undefined,
): boolean {
  if (!user?.role) return false;
  return (ADMIN_ROLES as string[]).includes(user.role);
}

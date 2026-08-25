// ===========================================
// Alcance territorial del usuario, del lado de la UI (R05)
// ===========================================
import { UserRole } from '@/types';

/**
 * Roles que ven la provincia entera. Espejo de `ROLES_ALCANCE_PROVINCIAL`
 * (`backend/src/common/scope/scope.types.ts`).
 *
 * Todo rol que no esté acá queda acotado a su departamento (o a los
 * departamentos de su zona) por el backend, sin importar qué mande la UI.
 */
export const ROLES_CON_ALCANCE_PROVINCIAL: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_PROVINCIAL,
];

/** ¿Este rol ve toda la provincia? */
export function tieneAlcanceProvincial(role: UserRole | undefined | null): boolean {
  return !!role && ROLES_CON_ALCANCE_PROVINCIAL.includes(role);
}

/**
 * ¿Mostrar el filtro "Departamento"?
 *
 * Para un rol acotado el filtro es ruido con forma de promesa: el backend ya
 * recortó el resultado a su territorio y escribir el nombre de otro
 * departamento devuelve una tabla vacía —el filtro del cliente y el recorte van
 * bajo `AND`—. Ofrecerlo sugiere un alcance que no existe.
 */
export function puedeFiltrarPorDepartamento(
  role: UserRole | undefined | null,
): boolean {
  return tieneAlcanceProvincial(role);
}

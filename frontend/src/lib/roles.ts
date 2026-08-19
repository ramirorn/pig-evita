// ===========================================
// Grupos de roles por sección del panel admin
// ===========================================
import { UserRole } from '@/types';

/**
 * Espejo de los grupos de roles del backend (hallazgo F8).
 *
 * Cada constante replica el `@Roles(...)` que el backend exige para la operación
 * principal de esa sección (`backend/src/common/constants/index.ts` y los
 * controllers de cada módulo). El backend sigue siendo la autoridad: esto evita
 * que la ruta sea siquiera alcanzable, para que un `ARBITRO` no llegue a
 * `/admin/usuarios` y dispare un 403 que ensucia los logs.
 *
 * ⚠️ Si cambia un `@Roles(...)` en el backend, hay que actualizar la constante
 * correspondiente acá.
 */

/** `ADMIN_ROLES` del backend. */
export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_PROVINCIAL,
  UserRole.ADMIN_DEPARTAMENTAL,
  UserRole.ADMIN_ZONAL,
];

/** Alta y edición del catálogo deportivo: disciplinas y categorías. */
export const CATALOG_MANAGERS: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_PROVINCIAL,
];

/** `INSCRIPTION_REVIEWERS` / `INSCRIPTION_CREATORS` del backend. */
export const INSCRIPTION_MANAGERS: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.DELEGADO,
];

/** Participantes, equipos y documentos: admins + delegados + coordinadores. */
export const PARTICIPANT_MANAGERS: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.DELEGADO,
  UserRole.COORDINADOR,
];

/** Carga de resultados: `@Roles(...ADMIN_ROLES, Role.ARBITRO)`. */
export const RESULT_LOADERS: UserRole[] = [...ADMIN_ROLES, UserRole.ARBITRO];

/** Reportes: `@Roles(...ADMIN_ROLES, Role.DELEGADO)`. */
export const REPORT_VIEWERS: UserRole[] = [...ADMIN_ROLES, UserRole.DELEGADO];

/** Dashboard: `@Roles(...ADMIN_ROLES, Role.COORDINADOR)`. */
export const DASHBOARD_VIEWERS: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.COORDINADOR,
];

/** Usuarios y auditoría: sólo la cúpula. */
export const SYSTEM_MANAGERS: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_PROVINCIAL,
];

/**
 * Quién puede entrar al área `/admin` en general.
 *
 * Es la unión de todos los grupos de arriba: sirve de primer filtro en el layout,
 * pero **no** reemplaza al `allowedRoles` de cada ruta. Un `ARBITRO` entra al
 * área (carga resultados) y aun así no debe alcanzar `/admin/usuarios`.
 */
export const ADMIN_AREA_ROLES: UserRole[] = Array.from(
  new Set<UserRole>([
    ...ADMIN_ROLES,
    ...INSCRIPTION_MANAGERS,
    ...PARTICIPANT_MANAGERS,
    ...RESULT_LOADERS,
    ...DASHBOARD_VIEWERS,
  ]),
);

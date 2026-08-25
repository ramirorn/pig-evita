// ===========================================
// Qué rol puede ejecutar qué ACCIÓN dentro de una pantalla (R22)
// ===========================================
import { UserRole } from '@/types';
import { ROUTES } from '@/lib/constants';
import type { AdminRoutePath } from '@/lib/adminRoutes';

/**
 * Espejo de `ACCIONES` del backend (`src/common/constants/index.ts`).
 *
 * `adminRoutes.ts` resolvió "qué rol ve qué **pantalla**" (R08). Esto resuelve
 * la otra mitad, que es la que quedaba abierta: qué rol puede ejecutar cada
 * **acción** de adentro de esa pantalla. No son lo mismo, y ahí estaba el bug:
 * la ruta de Participantes exigía `PARTICIPANT_MANAGERS`, pero el `POST` del
 * backend excluye a `COORDINADOR` y el `PATCH` excluye además a `ADMIN_ZONAL`.
 * Un ADMIN_ZONAL veía "Editar", abría el diálogo, corregía un domicilio,
 * guardaba, y recibía "Error al actualizar el participante" sin que nada le
 * dijera que jamás iba a poder.
 *
 * ⚠️ Esto **no** es un control de seguridad: quien decide es el backend. Sirve
 * para que la pantalla no ofrezca caminos cerrados ni esconda los abiertos.
 *
 * La sincronización no depende de la buena memoria de nadie: `npm run check:nav`
 * bundlea el archivo de constantes del backend y compara acción por acción. Si
 * allá cambia un `@Roles(...)` y acá no, el chequeo se pone en rojo.
 */
export const ACTION_ROLES = {
  // --- Participantes ---
  PARTICIPANT_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
    UserRole.COORDINADOR,
  ],
  PARTICIPANT_CREATE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  PARTICIPANT_UPDATE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.DELEGADO,
  ],
  PARTICIPANT_UPDATE_DNI: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],

  // --- Equipos ---
  TEAM_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
    UserRole.COORDINADOR,
  ],
  TEAM_CREATE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
    UserRole.COORDINADOR,
  ],
  TEAM_UPDATE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  TEAM_DELETE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  TEAM_MEMBER_MANAGE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
    UserRole.COORDINADOR,
  ],

  // --- Inscripciones ---
  INSCRIPTION_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  INSCRIPTION_CREATE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  INSCRIPTION_REVIEW: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  INSCRIPTION_APPROVE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
  ],
  INSCRIPTION_REJECT: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],

  // --- Documentación ---
  DOCUMENT_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
    UserRole.COORDINADOR,
  ],
  DOCUMENT_UPLOAD: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],
  DOCUMENT_REVIEW: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],

  // --- Reportes ---
  REPORT_EXPORT: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.DELEGADO,
  ],

  // --- Competencias y resultados ---
  COMPETITION_MANAGE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],
  RESULT_LOAD: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.ARBITRO,
  ],

  // --- Catálogo deportivo ---
  DISCIPLINE_MANAGE: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],
  CATEGORY_MANAGE: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],

  // --- Contenido y sedes ---
  NEWS_MANAGE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],
  CALENDAR_MANAGE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],
  VENUE_MANAGE: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],

  /** Panel de resumen: el COORDINADOR lo ve aunque no edite nada. */
  DASHBOARD_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
    UserRole.COORDINADOR,
  ],

  // --- Sistema ---
  USER_READ: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],
  USER_MANAGE: [UserRole.SUPER_ADMIN],
  AUDIT_READ: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],
  ZONE_READ: [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN_PROVINCIAL,
    UserRole.ADMIN_DEPARTAMENTAL,
    UserRole.ADMIN_ZONAL,
  ],
  ZONE_WRITE: [UserRole.SUPER_ADMIN, UserRole.ADMIN_PROVINCIAL],
} satisfies Record<string, UserRole[]>;

/** Nombre de una acción protegida. */
export type AccionProtegida = keyof typeof ACTION_ROLES;

/** ¿Este rol puede ejecutar esta acción? Sin rol (sesión vencida), no. */
export function puedeAccion(
  role: UserRole | undefined | null,
  accion: AccionProtegida,
): boolean {
  if (!role) return false;
  return (ACTION_ROLES[accion] as UserRole[]).includes(role);
}

/**
 * Dónde vive el botón de cada acción.
 *
 * Es lo que permite chequear la dirección que se olvida: que ninguna acción
 * permitida quede **inalcanzable**. Si un rol puede ejecutar `TEAM_DELETE` pero
 * no puede entrar a ninguna pantalla donde ese botón exista, el permiso es
 * decorativo — y al revés, una pantalla que ofrece una acción que su propio
 * grupo de roles no puede ejecutar es el 403 con el que arrancó R22.
 *
 * Sólo se listan acciones con botón en el panel. Las de lectura no van: no
 * tienen botón, las ejerce la propia pantalla al cargar.
 */
export const ACCIONES_POR_PANTALLA: Partial<
  Record<AdminRoutePath, AccionProtegida[]>
> = {
  [ROUTES.PARTICIPANTS]: ['PARTICIPANT_CREATE', 'PARTICIPANT_UPDATE'],
  [ROUTES.TEAMS]: ['TEAM_CREATE', 'TEAM_UPDATE', 'TEAM_DELETE'],
  [ROUTES.TEAM_DETAIL]: ['TEAM_MEMBER_MANAGE'],
  [ROUTES.INSCRIPTIONS]: ['INSCRIPTION_CREATE'],
  [ROUTES.NEW_INSCRIPTION]: ['INSCRIPTION_CREATE'],
  [ROUTES.INSCRIPTION_DETAIL]: [
    'INSCRIPTION_REVIEW',
    'INSCRIPTION_APPROVE',
    'INSCRIPTION_REJECT',
  ],
  [ROUTES.DOCUMENTS]: ['DOCUMENT_REVIEW'],
  [ROUTES.REPORTS]: ['REPORT_EXPORT'],
  [ROUTES.RESULTS]: ['RESULT_LOAD'],
  [ROUTES.COMPETITIONS]: ['COMPETITION_MANAGE'],
  [ROUTES.COMPETITION_DETAIL]: ['COMPETITION_MANAGE'],
  [ROUTES.DISCIPLINES_ADMIN]: ['DISCIPLINE_MANAGE'],
  [ROUTES.CATEGORIES_ADMIN]: ['CATEGORY_MANAGE'],
  [ROUTES.NEWS_ADMIN]: ['NEWS_MANAGE'],
  [ROUTES.CALENDAR_ADMIN]: ['CALENDAR_MANAGE'],
  [ROUTES.VENUES_ADMIN]: ['VENUE_MANAGE'],
  [ROUTES.USERS]: ['USER_MANAGE'],
};

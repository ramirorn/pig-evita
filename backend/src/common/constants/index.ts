// ===========================================
// System Constants and Enums
// ===========================================

/** Roles del sistema */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_PROVINCIAL = 'ADMIN_PROVINCIAL',
  ADMIN_DEPARTAMENTAL = 'ADMIN_DEPARTAMENTAL',
  ADMIN_ZONAL = 'ADMIN_ZONAL',
  COORDINADOR = 'COORDINADOR',
  DELEGADO = 'DELEGADO',
  ENTRENADOR = 'ENTRENADOR',
  ARBITRO = 'ARBITRO',
  OPERADOR_MESA = 'OPERADOR_MESA',
}

/** Roles con permisos de administración */
export const ADMIN_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
  Role.ADMIN_DEPARTAMENTAL,
  Role.ADMIN_ZONAL,
];

// Los grupos `INSCRIPTION_CREATORS` / `INSCRIPTION_REVIEWERS` /
// `INSCRIPTION_APPROVERS` y `RESULT_LOADERS` se borraron en R22: los reemplazan
// las entradas correspondientes de `ACCIONES` (abajo), que son las que el
// frontend espeja y `npm run check:nav` verifica. Dejarlos habría sido dejar una
// segunda lista con los mismos nombres y sin nadie que la mantenga —
// `RESULT_LOADERS` ya se había desincronizado: decía COORDINADOR y
// OPERADOR_MESA, y el `@Roles(...)` real de `results.controller.ts` nunca los
// tuvo.

/**
 * Roles habilitados a **cambiar el DNI** de un participante ya cargado (R17).
 *
 * El DNI no es un dato más del formulario: es la clave con la que se valida la
 * identidad del chico y con la que se cruzan los padrones. Cambiarlo sobre una
 * inscripción aprobada equivale a sustituir a la persona que va a competir, sin
 * que ninguna pantalla lo muestre como algo distinto de una corrección de
 * tipeo. Por eso queda fuera del alcance de los roles operativos
 * (`DELEGADO`, que es quien carga las altas del día) y sólo lo pueden hacer los
 * dos roles provinciales, con una fila de auditoría propia que guarda el valor
 * anterior y el nuevo.
 */
export const DNI_EDITORS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL];

/** Clave de metadata para marcar rutas públicas */
export const IS_PUBLIC_KEY = 'isPublic';

/** Clave de metadata para roles requeridos */
export const ROLES_KEY = 'roles';

/**
 * Acciones de auditoría.
 *
 * Las tres primeras las emite el `AuditInterceptor` solo, a partir del verbo
 * HTTP. El resto son eventos de negocio o de sesión: los de auth los emite
 * `AuthService` a mano, y los de inscripciones el propio interceptor cuando el
 * handler está marcado con `@Audit({ action })`. El contrato que decide qué va
 * por cada vía está en `common/decorators/audit.decorator.ts`.
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  /** Reuso de un refresh token ya rotado: señal fuerte de robo de sesión. */
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  /** Refresh rechazado por sesión inexistente o cuenta desactivada. */
  REFRESH_TOKEN_DENIED = 'REFRESH_TOKEN_DENIED',
  STATUS_CHANGE = 'STATUS_CHANGE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REVIEW_INSCRIPTION = 'REVIEW_INSCRIPTION',
  APPROVE_INSCRIPTION = 'APPROVE_INSCRIPTION',
  REJECT_INSCRIPTION = 'REJECT_INSCRIPTION',
  UPLOAD = 'UPLOAD',
  /** Cambio de DNI de un participante (R17): se audita aparte del UPDATE. */
  DNI_CHANGE = 'DNI_CHANGE',
}

// ===========================================
// Permisos por ACCIÓN (R22)
// ===========================================
//
// El problema que cierra: los grupos de arriba y los `@Roles(...)` inline de
// cada controller alcanzaban para decidir *quién entra a una pantalla*, pero la
// unidad real de permiso es la **acción**, no la sección. La ruta
// `/admin/participantes` exigía `PARTICIPANT_MANAGERS`, y adentro el `POST`
// excluía a `COORDINADOR` y el `PATCH` excluía además a `ADMIN_ZONAL`. El
// resultado en pantalla: un ADMIN_ZONAL veía "Editar", abría el diálogo,
// corregía un domicilio, guardaba, y recibía "Error al actualizar el
// participante" sin que nada le dijera que jamás iba a poder.
//
// Este mapa es la única fuente de verdad de esa correspondencia:
//
//   · los controllers declaran `@Roles(...ACCIONES.X)` en vez de listas inline,
//     así que el permiso que se aplica y el que se publica son el mismo objeto;
//   · `GET /auth/permissions` lo expone para que sea consultable;
//   · el frontend lo espeja en `src/lib/adminActions.ts` y `npm run check:nav`
//     compara el espejo contra ESTE archivo, bundleándolo de verdad. Si alguien
//     cambia un permiso acá y no allá, el chequeo se pone en rojo.
//
// Es la contracara de R08 (menú ⇔ router): lo que se muestra tiene que
// coincidir con lo que el backend acepta, **en las dos direcciones**.
//
// ⚠️ Al agregar un endpoint con `@Roles(...)`: agregá la acción acá y usá la
// constante. Un `@Roles(...)` inline vuelve a partir la verdad en dos.
export const ACCIONES = {
  // --- Participantes ---
  PARTICIPANT_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
    Role.COORDINADOR,
  ],
  /** Sin COORDINADOR: mira el padrón, no lo carga. */
  PARTICIPANT_CREATE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  /** Sin COORDINADOR ni ADMIN_ZONAL. */
  PARTICIPANT_UPDATE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.DELEGADO,
  ],
  /** El DNI es la identidad del chico, no un campo más del formulario (R17). */
  PARTICIPANT_UPDATE_DNI: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],

  // --- Equipos ---
  TEAM_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
    Role.COORDINADOR,
  ],
  TEAM_CREATE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
    Role.COORDINADOR,
  ],
  /** Sin COORDINADOR: arma planteles, no da de baja equipos. */
  TEAM_UPDATE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  TEAM_DELETE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  TEAM_MEMBER_MANAGE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
    Role.COORDINADOR,
  ],

  // --- Inscripciones ---
  INSCRIPTION_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  INSCRIPTION_CREATE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  INSCRIPTION_REVIEW: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  /** Aprobar es el acto final del trámite: sólo la línea provincial. */
  INSCRIPTION_APPROVE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
  ],
  INSCRIPTION_REJECT: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],

  // --- Documentación ---
  DOCUMENT_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
    Role.COORDINADOR,
  ],
  DOCUMENT_UPLOAD: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],
  /** Validar o rechazar un documento es acto administrativo. */
  DOCUMENT_REVIEW: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],

  // --- Reportes ---
  REPORT_EXPORT: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  ],

  // --- Competencias y resultados ---
  COMPETITION_MANAGE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],
  RESULT_LOAD: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.ARBITRO,
  ],

  // --- Catálogo deportivo ---
  DISCIPLINE_MANAGE: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],
  CATEGORY_MANAGE: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],

  // --- Contenido y sedes ---
  NEWS_MANAGE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],
  CALENDAR_MANAGE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],
  VENUE_MANAGE: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],

  /** Panel de resumen: el COORDINADOR lo ve aunque no edite nada. */
  DASHBOARD_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.COORDINADOR,
  ],

  // --- Sistema ---
  USER_READ: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],
  /** Alta, edición y baja de usuarios: sólo SUPER_ADMIN. */
  USER_MANAGE: [Role.SUPER_ADMIN],
  AUDIT_READ: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],
  /** Mapeo zona -> departamentos (R05). */
  ZONE_READ: [
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
  ],
  ZONE_WRITE: [Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL],
} satisfies Record<string, Role[]>;

/** Nombre de una acción protegida. */
export type AccionProtegida = keyof typeof ACCIONES;

/** Todas las acciones, para recorrer la matriz. */
export const TODAS_LAS_ACCIONES = Object.keys(ACCIONES) as AccionProtegida[];

/** ¿Este rol puede ejecutar esta acción? */
export function puedeAccion(
  role: Role | string | undefined | null,
  accion: AccionProtegida,
): boolean {
  if (!role) return false;
  return (ACCIONES[accion] as Role[]).includes(role as Role);
}

/** Acciones habilitadas para un rol. Es lo que publica `GET /auth/permissions`. */
export function accionesDe(
  role: Role | string | undefined | null,
): AccionProtegida[] {
  return TODAS_LAS_ACCIONES.filter((accion) => puedeAccion(role, accion));
}

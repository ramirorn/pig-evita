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

/** Roles que pueden crear inscripciones (delegados) */
export const INSCRIPTION_CREATORS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
  Role.ADMIN_DEPARTAMENTAL,
  Role.ADMIN_ZONAL,
  Role.DELEGADO,
];

/** Roles que pueden revisar inscripciones */
export const INSCRIPTION_REVIEWERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
  Role.ADMIN_DEPARTAMENTAL,
  Role.ADMIN_ZONAL,
  Role.DELEGADO,
];

/** Roles que pueden aprobar inscripciones */
export const INSCRIPTION_APPROVERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
  Role.ADMIN_DEPARTAMENTAL,
];

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

/** Roles que pueden cargar resultados */
export const RESULT_LOADERS: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
  Role.COORDINADOR,
  Role.ARBITRO,
  Role.OPERADOR_MESA,
];

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

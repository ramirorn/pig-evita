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

/** Acciones de auditoría */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  STATUS_CHANGE = 'STATUS_CHANGE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  UPLOAD = 'UPLOAD',
}

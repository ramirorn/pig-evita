// ===========================================
// Etiquetas de la auditoría (S8)
//
// El backend guarda la acción como un código en inglés (`AuditAction` en
// `backend/src/common/constants`) y la entidad como el primer segmento de la
// URL (`venues`, `inscriptions`, …) o un nombre puesto a mano (`User`). La
// pantalla de auditoría no puede mostrar ninguno de los dos tal cual: este
// módulo los traduce, y para un valor que todavía no tiene etiqueta arma uno
// legible en lugar de mostrar el código crudo.
//
// `npm run check:audit` compara este mapa contra el enum REAL del backend: si
// alguien agrega una acción allá y no la etiqueta acá, el chequeo falla.
// ===========================================

/** Texto que se muestra cuando no hay valor (acción o entidad vacía). */
const SIN_VALOR = '—';

/** Etiqueta en castellano de cada `AuditAction` del backend. */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
  CREATE: 'Alta',
  UPDATE: 'Edición',
  DELETE: 'Baja',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  REFRESH_TOKEN_REUSE: 'Reuso de sesión sospechoso',
  REFRESH_TOKEN_DENIED: 'Renovación de sesión rechazada',
  STATUS_CHANGE: 'Cambio de estado',
  APPROVE: 'Aprobación',
  REJECT: 'Rechazo',
  REVIEW_INSCRIPTION: 'Inscripción en revisión',
  APPROVE_INSCRIPTION: 'Inscripción aprobada',
  REJECT_INSCRIPTION: 'Inscripción rechazada',
  UPLOAD: 'Subida de archivo',
  DNI_CHANGE: 'Cambio de DNI',
  ACCESS_DENIED: 'Acceso denegado',
};

/**
 * Etiqueta de cada entidad auditada.
 *
 * Las claves son el primer segmento de la URL en minúsculas, que es lo que
 * guarda el interceptor, más los nombres que algunos servicios ponen a mano
 * (`User` en los eventos de sesión, `team_members` en el plantel).
 */
export const AUDIT_ENTITY_LABELS: Readonly<Record<string, string>> = {
  venues: 'Sedes',
  inscriptions: 'Inscripciones',
  calendar: 'Calendario',
  news: 'Noticias',
  participants: 'Participantes',
  competitions: 'Competencias',
  results: 'Resultados',
  teams: 'Equipos',
  team_members: 'Planteles',
  users: 'Usuarios',
  documents: 'Documentos',
  categories: 'Categorías',
  disciplines: 'Disciplinas',
  survey: 'Encuesta',
  zones: 'Zonas',
  metrics: 'Métricas',
  reports: 'Reportes',
  User: 'Sesión de usuario',
  Route: 'Ruta protegida',
};

/**
 * Entidades que se ofrecen en el filtro de la pantalla.
 *
 * `User` queda afuera: el backend filtra la entidad con `contains` sin
 * distinguir mayúsculas, así que pedir `User` traería también `users`. Los
 * eventos de sesión se filtran mejor por acción.
 */
export const AUDIT_ENTITY_FILTERS: readonly string[] = Object.keys(
  AUDIT_ENTITY_LABELS,
).filter((clave) => clave !== 'User');

/** Familia visual de una acción: decide el color del distintivo. */
export type TonoAccion = 'exito' | 'aviso' | 'peligro' | 'info' | 'neutro';

const TONO_POR_ACCION: Readonly<Record<string, TonoAccion>> = {
  CREATE: 'exito',
  UPLOAD: 'exito',
  APPROVE: 'exito',
  APPROVE_INSCRIPTION: 'exito',
  UPDATE: 'aviso',
  STATUS_CHANGE: 'aviso',
  DNI_CHANGE: 'aviso',
  REVIEW_INSCRIPTION: 'aviso',
  DELETE: 'peligro',
  REJECT: 'peligro',
  REJECT_INSCRIPTION: 'peligro',
  LOGIN_FAILED: 'peligro',
  REFRESH_TOKEN_REUSE: 'peligro',
  REFRESH_TOKEN_DENIED: 'peligro',
  ACCESS_DENIED: 'peligro',
  LOGIN: 'info',
  LOGOUT: 'info',
};

/**
 * Convierte un código desconocido (`SOME_ACTION`, `team-members`) en un texto
 * legible ("Some action", "Team members"). Es el último recurso: si existe una
 * etiqueta, nunca se llega acá.
 */
export function humanizarCodigo(valor: string): string {
  const limpio = valor.replace(/[_-]+/g, ' ').trim().toLowerCase();
  if (!limpio) return SIN_VALOR;
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Etiqueta en castellano de una acción de auditoría. */
export function etiquetaAccion(action: string | null | undefined): string {
  if (!action) return SIN_VALOR;
  return AUDIT_ACTION_LABELS[action] ?? AUDIT_ACTION_LABELS[action.toUpperCase()] ?? humanizarCodigo(action);
}

/** Etiqueta en castellano de una entidad de auditoría. */
export function etiquetaEntidad(entity: string | null | undefined): string {
  if (!entity) return SIN_VALOR;
  return AUDIT_ENTITY_LABELS[entity] ?? AUDIT_ENTITY_LABELS[entity.toLowerCase()] ?? humanizarCodigo(entity);
}

/** Tono del distintivo de una acción; lo desconocido queda neutro. */
export function tonoAccion(action: string | null | undefined): TonoAccion {
  if (!action) return 'neutro';
  return TONO_POR_ACCION[action] ?? TONO_POR_ACCION[action.toUpperCase()] ?? 'neutro';
}

/** Usuario tal como lo devuelve `GET /audit` (puede no haber: evento del sistema). */
export interface UsuarioAuditoria {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Quién hizo el movimiento. Sin usuario es un evento del sistema (o un inicio
 * de sesión fallido de alguien que no existe): se muestra "Sistema".
 */
export function autorAuditoria(user: UsuarioAuditoria | null | undefined): {
  nombre: string;
  email: string | null;
} {
  if (!user) return { nombre: 'Sistema', email: null };
  const nombre = [user.firstName, user.lastName]
    .map((parte) => (parte ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return { nombre: nombre || user.email, email: nombre ? user.email : null };
}

/**
 * Traduce el rango de días elegido (`YYYY-MM-DD`, hora local) a los filtros
 * `fromDate`/`toDate` del backend.
 *
 * Se mandan marcas de tiempo completas a propósito: con sólo la fecha, el
 * backend toma el día en UTC y un evento de las 22 h de Argentina caería en el
 * día siguiente. Una fecha mal formada no filtra.
 */
export function rangoAuditoria(
  desde: string,
  hasta: string,
): { fromDate?: string; toDate?: string } {
  const aFecha = (valor: string, finDelDia: boolean): string | undefined => {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (!partes) return undefined;
    const anio = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);
    const fecha = finDelDia
      ? new Date(anio, mes - 1, dia, 23, 59, 59, 999)
      : new Date(anio, mes - 1, dia, 0, 0, 0, 0);
    return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
  };
  const fromDate = aFecha(desde, false);
  const toDate = aFecha(hasta, true);
  return {
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
  };
}

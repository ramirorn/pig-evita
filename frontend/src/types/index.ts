// ===========================================
// TypeScript Types — Juegos Evita Formosa
// Derived from backend Prisma schema
// ===========================================

// ============ ENUMS ============

export enum UserRole {
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

export enum Sex {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
  MIXTO = 'MIXTO',
}

export enum DisciplineType {
  INDIVIDUAL = 'INDIVIDUAL',
  EQUIPO = 'EQUIPO',
}

export enum ResultType {
  TIEMPO = 'TIEMPO',
  GOLES = 'GOLES',
  SETS = 'SETS',
  PUNTOS = 'PUNTOS',
  POSICIONES = 'POSICIONES',
}

export enum InscriptionStatus {
  PENDIENTE = 'PENDIENTE',
  REVISADA = 'REVISADA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export enum DocumentType {
  DNI_FRENTE = 'DNI_FRENTE',
  DNI_DORSO = 'DNI_DORSO',
  CERTIFICADO_MEDICO = 'CERTIFICADO_MEDICO',
  AUTORIZACION_PARENTAL = 'AUTORIZACION_PARENTAL',
  FOTO = 'FOTO',
  OTRO = 'OTRO',
}

export enum DocumentStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum CompetitionStage {
  ZONAL = 'ZONAL',
  DEPARTAMENTAL = 'DEPARTAMENTAL',
  PROVINCIAL = 'PROVINCIAL',
}

export enum CompetitionFormat {
  ROUND_ROBIN = 'ROUND_ROBIN',
  ELIMINACION_DIRECTA = 'ELIMINACION_DIRECTA',
  FASE_GRUPOS = 'FASE_GRUPOS',
}

export enum CompetitionStatus {
  BORRADOR = 'BORRADOR',
  ACTIVA = 'ACTIVA',
  FINALIZADA = 'FINALIZADA',
}

export enum MatchStatus {
  PROGRAMADO = 'PROGRAMADO',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

// ============ ENTITY INTERFACES ============

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  department?: string | null;
  zone?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: Sex;
  phone?: string | null;
  email?: string | null;
  locality: string;
  department: string;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (when included)
  inscriptions?: Inscription[];
  documents?: Document[];
  teamMembers?: TeamMember[];
}

export interface Discipline {
  id: string;
  name: string;
  type: DisciplineType;
  resultType: ResultType;
  rules?: string | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  categories?: Category[];
}

export interface Category {
  id: string;
  disciplineId: string;
  name: string;
  minAge: number;
  maxAge: number;
  sex: Sex;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  discipline?: Discipline;
}

export interface Team {
  id: string;
  name: string;
  disciplineId: string;
  categoryId: string;
  locality: string;
  department: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  discipline?: Discipline;
  category?: Category;
  /** Sólo en el detalle: el listado devuelve `_count` para no traer el plantel. */
  members?: TeamMember[];
  _count?: { members: number };
}

export interface TeamMember {
  id: string;
  teamId: string;
  participantId: string;
  position?: string | null;
  shirtNumber?: number | null;
  isCaptain: boolean;
  createdAt: string;
  // Relations
  participant?: Participant;
  team?: Team;
}

export interface Inscription {
  id: string;
  participantId: string;
  categoryId: string;
  teamId?: string | null;
  createdById?: string | null;
  status: InscriptionStatus;
  qrCode: string;
  qrImage?: string | null;
  notes?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  participant?: Participant;
  category?: Category;
  team?: Team;
  createdBy?: User;
  reviewedBy?: User;
  approvedBy?: User;
}

/**
 * Respuesta del endpoint PÚBLICO `GET /inscriptions/qr/:qrCode`.
 * Superficie mínima a propósito: el backend no devuelve DNI, email, teléfono,
 * fecha de nacimiento, dirección ni notas internas para esta consulta.
 */
export interface PublicInscription {
  qrCode: string;
  status: InscriptionStatus;
  createdAt: string;
  participant: {
    firstName: string;
    lastName: string;
  };
  category: {
    name: string;
    discipline: {
      name: string;
    };
  };
}

export interface DocumentEntity {
  id: string;
  participantId: string;
  documentType: DocumentType;
  fileKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  // Extra
  url?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  department: string;
  locality: string;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Competition {
  id: string;
  disciplineId: string;
  categoryId: string;
  stage: CompetitionStage;
  format: CompetitionFormat;
  status: CompetitionStatus;
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  config?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  discipline?: Discipline;
  category?: Category;
  matches?: Match[];
}

export interface Match {
  id: string;
  competitionId: string;
  venueId?: string | null;
  round: number;
  matchNumber: number;
  status: MatchStatus;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  venue?: Venue;
  results?: Result[];
}

export interface Result {
  id: string;
  matchId: string;
  participantId?: string | null;
  teamId?: string | null;
  scoreData: Record<string, unknown>;
  ranking?: number | null;
  isWinner: boolean;
  /**
   * Localía (R23). `true` = local, `false` = visitante, `null`/ausente = no
   * aplica (disciplinas individuales, o filas cargadas antes de que el campo
   * existiera).
   *
   * Antes la pantalla infería la localía del **orden** de `results`, que el
   * backend no garantizaba: el mismo partido podía leerse con los equipos
   * invertidos entre un refetch y el siguiente.
   */
  isHome?: boolean | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  participant?: Participant;
  team?: Team;
}

export interface News {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  imageKey?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  authorId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  stage?: CompetitionStage | null;
  venueId?: string | null;
  disciplineId?: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  createdAt: string;
  localities?: Locality[];
}

export interface Locality {
  id: string;
  name: string;
  departmentId: string;
  createdAt: string;
  department?: Department;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  // Relations
  user?: User;
}

// ============ API RESPONSE TYPES ============

/** Paginated response wrapper used by the backend */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Perfil del usuario autenticado, tal como lo devuelve `GET /auth/me`. */
export interface AuthUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

/**
 * Respuesta del login.
 *
 * No incluye `refreshToken` a propósito: viaja en una cookie httpOnly que el
 * navegador administra y JavaScript no puede leer (hallazgo C-03).
 */
export interface AuthResponse {
  accessToken: string;
  user: AuthUserProfile;
}

/** Auth refresh response */
export interface RefreshResponse {
  accessToken: string;
}

/** Dashboard stats response */
/**
 * Fila del donut "Inscripciones por Estado".
 *
 * El backend garantiza que vienen **siempre los 4 estados**, en el orden del
 * enum, con `count: 0` cuando no hay filas. Por eso el front no tiene que
 * completar faltantes ni ordenar: sólo filtrar los ceros para que el gráfico no
 * dibuje porciones invisibles.
 */
export interface DashboardStatusCount {
  status: InscriptionStatus;
  count: number;
}

/**
 * Inscripción tal como la devuelve el widget de recientes.
 *
 * Es un tipo propio y no `Inscription` a propósito: el endpoint del dashboard
 * expone una superficie mínima (sin DNI ni datos de contacto del participante,
 * sin notas internas) porque es un resumen de lectura rápida. Tiparlo como
 * `Inscription` daría a entender que esos campos están disponibles cuando en
 * realidad llegan `undefined`.
 */
export interface DashboardRecentInscription {
  id: string;
  qrCode: string;
  status: InscriptionStatus;
  createdAt: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
  };
  category: {
    id: string;
    name: string;
  };
}

/**
 * Respuesta de `GET /dashboard/stats`.
 *
 * Un único endpoint que reemplaza las 8 requests que hacía el dashboard
 * (hallazgo Q3). El backend la sirve cacheada, así que puede tener hasta 60 s
 * de atraso: `lastUpdated` indica de cuándo son los números.
 */
export interface DashboardStats {
  totalParticipants: number;
  totalTeams: number;
  totalInscriptions: number;
  totalCompetitions: number;
  inscriptionsByStatus: DashboardStatusCount[];
  demographics: Array<{
    sex: Sex;
    count: number;
  }>;
  recentInscriptions: DashboardRecentInscription[];
  lastUpdated: string;
}

/** JWT payload (decoded) */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ===========================================
// Application Constants
// ===========================================
import {
  UserRole,
  InscriptionStatus,
  DocumentStatus,
  CompetitionStatus,
  MatchStatus,
  CompetitionStage,
  CompetitionFormat,
  DisciplineType,
  ResultType,
  Sex,
} from '@/types';

// ============ ROUTES ============

export const ROUTES = {
  // Public
  HOME: '/',
  DISCIPLINES: '/disciplinas',
  DISCIPLINE_DETAIL: '/disciplinas/:id',
  NEWS: '/noticias',
  NEWS_DETAIL: '/noticias/:slug',
  CALENDAR: '/calendario',
  VENUES: '/sedes',
  RANKINGS: '/rankings',
  COMPETITION_PUBLIC: '/competencias/:id',
  INSCRIPTION: '/inscripcion',

  // Auth
  LOGIN: '/admin/login',

  // Admin
  ADMIN: '/admin',
  DASHBOARD: '/admin/dashboard',
  PARTICIPANTS: '/admin/participantes',
  PARTICIPANT_DETAIL: '/admin/participantes/:id',
  INSCRIPTIONS: '/admin/inscripciones',
  INSCRIPTION_DETAIL: '/admin/inscripciones/:id',
  DISCIPLINES_ADMIN: '/admin/disciplinas',
  CATEGORIES_ADMIN: '/admin/categorias',
  TEAMS: '/admin/equipos',
  TEAM_DETAIL: '/admin/equipos/:id',
  COMPETITIONS: '/admin/competencias',
  COMPETITION_DETAIL: '/admin/competencias/:id',
  RESULTS: '/admin/resultados',
  DOCUMENTS: '/admin/documentos',
  NEWS_ADMIN: '/admin/noticias',
  CALENDAR_ADMIN: '/admin/calendario',
  VENUES_ADMIN: '/admin/sedes',
  USERS: '/admin/usuarios',
  REPORTS: '/admin/reportes',
  AUDIT: '/admin/auditoria',
} as const;

// ============ ROLE LABELS ============

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Administrador',
  [UserRole.ADMIN_PROVINCIAL]: 'Admin Provincial',
  [UserRole.ADMIN_DEPARTAMENTAL]: 'Admin Departamental',
  [UserRole.ADMIN_ZONAL]: 'Admin Zonal',
  [UserRole.COORDINADOR]: 'Coordinador',
  [UserRole.DELEGADO]: 'Delegado',
  [UserRole.ENTRENADOR]: 'Entrenador',
  [UserRole.ARBITRO]: 'Árbitro',
  [UserRole.OPERADOR_MESA]: 'Operador de Mesa',
};

export const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_PROVINCIAL,
  UserRole.ADMIN_DEPARTAMENTAL,
  UserRole.ADMIN_ZONAL,
];

// ============ STATUS LABELS ============

export const INSCRIPTION_STATUS_LABELS: Record<InscriptionStatus, string> = {
  [InscriptionStatus.PENDIENTE]: 'Pendiente',
  [InscriptionStatus.REVISADA]: 'Revisada',
  [InscriptionStatus.APROBADA]: 'Aprobada',
  [InscriptionStatus.RECHAZADA]: 'Rechazada',
};

export const INSCRIPTION_STATUS_COLORS: Record<InscriptionStatus, string> = {
  [InscriptionStatus.PENDIENTE]: 'bg-amber-100 text-amber-800 border-amber-200',
  [InscriptionStatus.REVISADA]: 'bg-blue-100 text-blue-800 border-blue-200',
  [InscriptionStatus.APROBADA]: 'bg-green-100 text-green-800 border-green-200',
  [InscriptionStatus.RECHAZADA]: 'bg-red-100 text-red-800 border-red-200',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.PENDIENTE]: 'Pendiente',
  [DocumentStatus.APROBADO]: 'Aprobado',
  [DocumentStatus.RECHAZADO]: 'Rechazado',
};

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  [CompetitionStatus.BORRADOR]: 'Borrador',
  [CompetitionStatus.ACTIVA]: 'Activa',
  [CompetitionStatus.FINALIZADA]: 'Finalizada',
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  [MatchStatus.PROGRAMADO]: 'Programado',
  [MatchStatus.EN_CURSO]: 'En Curso',
  [MatchStatus.FINALIZADO]: 'Finalizado',
  [MatchStatus.SUSPENDIDO]: 'Suspendido',
};

// ============ ENUM LABELS ============

export const STAGE_LABELS: Record<CompetitionStage, string> = {
  [CompetitionStage.ZONAL]: 'Zonal',
  [CompetitionStage.DEPARTAMENTAL]: 'Departamental',
  [CompetitionStage.PROVINCIAL]: 'Provincial',
};

export const FORMAT_LABELS: Record<CompetitionFormat, string> = {
  [CompetitionFormat.ROUND_ROBIN]: 'Todos contra todos',
  [CompetitionFormat.ELIMINACION_DIRECTA]: 'Eliminación directa',
  [CompetitionFormat.FASE_GRUPOS]: 'Fase de grupos',
};

export const DISCIPLINE_TYPE_LABELS: Record<DisciplineType, string> = {
  [DisciplineType.INDIVIDUAL]: 'Individual',
  [DisciplineType.EQUIPO]: 'Equipo',
};

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  [ResultType.TIEMPO]: 'Tiempo',
  [ResultType.GOLES]: 'Goles',
  [ResultType.SETS]: 'Sets',
  [ResultType.PUNTOS]: 'Puntos',
  [ResultType.POSICIONES]: 'Posiciones',
};

export const SEX_LABELS: Record<Sex, string> = {
  [Sex.MASCULINO]: 'Masculino',
  [Sex.FEMENINO]: 'Femenino',
  [Sex.MIXTO]: 'Mixto',
};

// ============ PAGINATION ============

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============ FILE UPLOAD ============

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

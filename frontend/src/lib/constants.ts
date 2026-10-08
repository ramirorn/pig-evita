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
  SurveyAudience,
  SurveyCampaignStatus,
  SurveyQuestionKind,
  SurveyWindow,
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
  /** Mapa de calor de la participación por localidad. */
  IMPACT_MAP: '/mapa',
  INSCRIPTION: '/inscripcion',
  /** Landing informativa de la encuesta de salud mental (S20). */
  SURVEY: '/encuesta',
  /**
   * El cuestionario, como **ruta propia** y no como modal sobre la landing.
   *
   * Es el formulario que se difunde por QR en las canchas: una URL que se puede
   * imprimir, mandar por WhatsApp y volver a abrir después de que se corte la
   * señal. Un modal no tiene URL, se pierde con el primer refresh y obliga a
   * releer la landing entera para volver a la pregunta 6.
   */
  SURVEY_FORM: '/encuesta/responder',

  // Auth
  LOGIN: '/admin/login',

  // Admin
  ADMIN: '/admin',
  DASHBOARD: '/admin/dashboard',
  /** El mismo mapa de impacto del sitio público, dentro del panel. */
  IMPACT_MAP_ADMIN: '/admin/mapa',
  PARTICIPANTS: '/admin/participantes',
  PARTICIPANT_DETAIL: '/admin/participantes/:id',
  INSCRIPTIONS: '/admin/inscripciones',
  INSCRIPTION_DETAIL: '/admin/inscripciones/:id',
  NEW_INSCRIPTION: '/admin/nueva-inscripcion',
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
  /** Listado de campañas de la encuesta de salud mental (S20). */
  SURVEY_ADMIN: '/admin/encuesta',
  /**
   * Editor de una campaña: cuestionario y tablero de resultados.
   *
   * Es una ruta propia y no un modal sobre el listado porque acá se trabaja
   * largo —se redacta un cuestionario entero— y porque el tablero de una
   * campaña es algo que se comparte por link dentro del equipo.
   */
  SURVEY_CAMPAIGN_DETAIL: '/admin/encuesta/:id',
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

// ============ ENCUESTA (S20) ============

export const SURVEY_WINDOW_LABELS: Record<SurveyWindow, string> = {
  [SurveyWindow.PRE]: 'Antes de competir',
  [SurveyWindow.DURANTE]: 'Durante la competencia',
  [SurveyWindow.POST]: 'Después de competir',
};

export const SURVEY_CAMPAIGN_STATUS_LABELS: Record<SurveyCampaignStatus, string> = {
  [SurveyCampaignStatus.BORRADOR]: 'Borrador',
  [SurveyCampaignStatus.ACTIVA]: 'Activa',
  [SurveyCampaignStatus.CERRADA]: 'Cerrada',
};

export const SURVEY_QUESTION_KIND_LABELS: Record<SurveyQuestionKind, string> = {
  [SurveyQuestionKind.UNICA]: 'Una sola opción',
  [SurveyQuestionKind.MULTIPLE]: 'Varias opciones',
};

export const SURVEY_AUDIENCE_LABELS: Record<SurveyAudience, string> = {
  [SurveyAudience.TODOS]: 'Todos',
  [SurveyAudience.INDIVIDUAL]: 'Deportes individuales',
  [SurveyAudience.EQUIPO]: 'Deportes de equipo',
};

// ============ PAGINATION ============

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ============ TERRITORIO ============

/**
 * Los nueve departamentos de Formosa, en orden alfabético.
 *
 * Única fuente para los selects de inscripción, plantel, usuarios y sedes:
 * antes había cuatro copias, cada una en su propio orden.
 */
export const DEPARTMENTS_FORMOSA = [
  'Bermejo',
  'Formosa',
  'Laishí',
  'Matacos',
  'Patiño',
  'Pilagás',
  'Pilcomayo',
  'Pirané',
  'Ramón Lista',
] as const;

/** Departamentos como opciones de `SelectField` (valor = etiqueta). */
export const DEPARTMENT_OPTIONS = DEPARTMENTS_FORMOSA.map((departamento) => ({
  value: departamento,
  label: departamento,
}));

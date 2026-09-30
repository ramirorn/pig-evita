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
  /**
   * Plantel reglamentario de una disciplina de **equipo**: cuántos titulares
   * exige el deporte y cuántos suplentes admite como máximo.
   *
   * Son `null` en las disciplinas `INDIVIDUAL` (no significan nada ahí) y
   * también en las de `EQUIPO` que todavía no se configuraron desde el ABM de
   * Disciplinas. Esa segunda posibilidad es la que obliga a chequearlos antes
   * de abrir la carga del plantel: sin ellos no hay contra qué contar, y el
   * backend rechaza el alta.
   */
  titulares?: number | null;
  maxSuplentes?: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Relations
  categories?: Category[];
  /**
   * Sólo en el **listado**: `GET /disciplines` devuelve `_count.categories`
   * (verificado contra la API en vivo, 2026-08-31). El detalle por id devuelve
   * `categories[]` en su lugar y **no** trae `_count`, por eso es opcional.
   * Mismo patrón que `Team._count`. No requiere cambio del modelo Prisma: el
   * dato ya viajaba y era el tipo del cliente el que no lo declaraba.
   */
  _count?: { categories: number };
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
 * Un integrante ya inscripto, tal como vuelve de `POST /inscriptions/team`.
 *
 * Es una superficie mínima a propósito, no una ficha: del participante sólo
 * viajan id, DNI, nombre y apellido (`TeamInscriptionMemberDto` en el backend).
 * Los datos de contacto se piden por `GET /inscriptions/:id` si hacen falta.
 */
export interface TeamInscriptionMember {
  participantId: string;
  dni: string;
  firstName: string;
  lastName: string;
  /** `true` ⇒ suplente. */
  isSubstitute: boolean;
  isCaptain: boolean;
  position: string | null;
  shirtNumber: number | null;
  inscriptionId: string;
  qrCode: string;
  status: InscriptionStatus;
  /** QR renderizado como data URL PNG. */
  qrImage: string;
}

/**
 * Respuesta de `POST /inscriptions/team`.
 *
 * Réplica manual de `TeamInscriptionResultDto`
 * (`backend/src/modules/inscriptions/dto/inscriptions.dto.ts`), que es la
 * fuente de verdad. El endpoint es transaccional: o vuelve el plantel entero
 * inscripto, o no se creó nada y llega un error. No existe el caso "se
 * cargaron 9 de 11".
 *
 * `discipline` y `category` repiten la composición contra la que el servidor
 * validó, para poder confirmar en pantalla que se cargó lo que correspondía.
 */
export interface TeamInscriptionResult {
  team: { id: string; name: string; locality: string; department: string };
  discipline: { id: string; name: string; titulares: number; maxSuplentes: number };
  category: { id: string; name: string; minAge: number; maxAge: number; sex: Sex };
  totals: { titulares: number; suplentes: number; total: number };
  /** Un elemento por integrante, en el mismo orden del request. */
  members: TeamInscriptionMember[];
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
  /**
   * URL pre-firmada de MinIO, de corta duración. Sólo la trae
   * `GET /documents/participant/:id` (el bucket es privado).
   */
  presignedUrl?: string;
  /** Sólo en la respuesta de `PATCH /documents/:id/review`. */
  participant?: Pick<Participant, 'dni' | 'firstName' | 'lastName'>;
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
  /**
   * Foto principal: `/api/v1/venues/<id>/image?v=<versión>`, relativa al
   * ORIGEN de la API, o `null` si no tiene. La versión cambia al reemplazarla.
   * Nunca se usa cruda: pasa por `resolveVenueImageUrl`.
   */
  imageUrl: string | null;
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
  /**
   * Sólo en el **listado**: `GET /competitions` devuelve `_count.matches`
   * (verificado contra la API en vivo, 2026-08-31). Es lo que permite decir si
   * hay fixture generado sin traerse los partidos. Opcional porque el detalle
   * por id devuelve `matches[]` y no el conteo.
   */
  _count?: { matches: number };
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
  /**
   * S19 — noticias traídas del portal oficial (formosa.gob.ar).
   *
   * `isExternal` cambia dos cosas en la UI y ninguna es cosmética: la tarjeta
   * lleva a `sourceUrl` en vez de al detalle propio (de la nota ajena no
   * tenemos el cuerpo, sólo la bajada), y en el panel no se ofrece editarla ni
   * eliminarla, porque el backend lo rechaza y el sync la volvería a crear.
   */
  sourceUrl?: string | null;
  sourceName?: string | null;
  isExternal?: boolean;
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

// ============ ENCUESTA DE SALUD MENTAL (S20) ============
//
// Réplica manual del contrato de `backend/src/modules/survey/` (AGENTS §4: el
// backend es la fuente de verdad y acá no hay generación automática).

/** Momento de la competencia en el que se responde. */
export enum SurveyWindow {
  PRE = 'PRE',
  DURANTE = 'DURANTE',
  POST = 'POST',
}

/** Ciclo de vida de una campaña. Las transiciones son endpoints propios. */
export enum SurveyCampaignStatus {
  BORRADOR = 'BORRADOR',
  ACTIVA = 'ACTIVA',
  CERRADA = 'CERRADA',
}

/** `UNICA` admite exactamente una opción; `MULTIPLE`, una o más. */
export enum SurveyQuestionKind {
  UNICA = 'UNICA',
  MULTIPLE = 'MULTIPLE',
}

/**
 * A quién se le muestra una pregunta.
 *
 * `INDIVIDUAL` y `EQUIPO` se contrastan contra el `DisciplineType` de la
 * disciplina que eligió quien responde. El endpoint público devuelve **las tres
 * audiencias juntas** —cuando se pide el cuestionario todavía no se sabe qué
 * disciplina va a elegir—, así que el filtrado ocurre en pantalla y el servidor
 * lo revalida al recibir el envío.
 */
export enum SurveyAudience {
  TODOS = 'TODOS',
  INDIVIDUAL = 'INDIVIDUAL',
  EQUIPO = 'EQUIPO',
}

export interface SurveyOption {
  id: string;
  questionId: string;
  orden: number;
  texto: string;
  /**
   * Slug estable en snake_case. Es la clave con la que se agregan las métricas:
   * el `texto` se puede reescribir, `valor` no.
   */
  valor: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  campaignId: string;
  orden: number;
  texto: string;
  ayuda?: string | null;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  obligatoria: boolean;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  /** Presente en `GET /survey/active` y en el detalle de campaña. */
  options?: SurveyOption[];
}

/** Pregunta tal como llega en un cuestionario: siempre con sus opciones. */
export type SurveyQuestionWithOptions = SurveyQuestion & {
  options: SurveyOption[];
};

export interface SurveyCampaign {
  id: string;
  titulo: string;
  descripcion?: string | null;
  anio: number;
  status: SurveyCampaignStatus;
  ventana: SurveyWindow;
  /** `null` = la campaña sirve para cualquier etapa. */
  etapa?: CompetitionStage | null;
  abreEn?: string | null;
  cierraEn?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: SurveyQuestion[];
  /**
   * Sólo en el **listado** (`questions` + `responses`) y en el detalle
   * (`responses`). Mismo patrón que `Discipline._count`.
   */
  _count?: {
    questions?: number;
    responses?: number;
  };
}

/** Campaña con su cuestionario completo (detalle admin y `GET /survey/active`). */
export type SurveyCampaignWithQuestions = SurveyCampaign & {
  questions: SurveyQuestionWithOptions[];
};

/**
 * Acuse del envío público.
 *
 * ⚠️ **No trae `id` y no es un olvido.** Un identificador de respuesta en manos
 * del cliente es un recibo que ata un dispositivo a una fila que existe
 * justamente para no estar atada a nadie. Por eso la pantalla de cierre no
 * puede —ni debe— ofrecer "ver mis respuestas".
 */
export interface SurveySubmitResult {
  registrada: true;
  enviadaEn: string;
}

/** Motivo único de supresión por k-anonimato. */
export const MOTIVO_SUPRESION_ENCUESTA = 'MUESTRA_INSUFICIENTE';
export type MotivoSupresionEncuesta = typeof MOTIVO_SUPRESION_ENCUESTA;

/**
 * Corte de métricas que no se publica porque tiene menos respuestas que el
 * umbral de k-anonimato.
 *
 * `conteo: null` y no `0`: el corte existe y tiene respuestas, lo que no se
 * publica es cuántas. La UI tiene que decir **que está suprimido y por qué**;
 * pintarlo como cero miente e invita a sumar los cortes para despejarlo.
 */
export interface CorteSuprimido {
  suprimido: true;
  motivo: MotivoSupresionEncuesta;
  conteo: null;
}

export interface CorteVisible {
  suprimido: false;
  conteo: number;
}

export type CorteEncuesta = CorteVisible | CorteSuprimido;

export interface SurveyOptionMetric {
  optionId: string;
  valor: string;
  texto: string;
  orden: number;
  conteo: number;
  /** Sobre el total de respuestas de **esa pregunta**, con 1 decimal. */
  porcentaje: number;
}

export interface SurveyQuestionMetric {
  questionId: string;
  orden: number;
  texto: string;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  activa: boolean;
  /** Respuestas que contestaron esta pregunta, no el total de la campaña. */
  totalRespuestas: number;
  opciones: SurveyOptionMetric[];
}

export interface SurveyMetricsFiltros {
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
  disciplineId?: string;
  disciplineType?: DisciplineType;
  localityId?: string;
}

export interface SurveyMetricsResult {
  campaignId: string;
  titulo: string;
  filtros: SurveyMetricsFiltros;
  /** Umbral vigente de k-anonimato, para que la pantalla pueda explicarlo. */
  umbral: number;
  totalRespuestas: number;
  suprimido: boolean;
  motivo: MotivoSupresionEncuesta | null;
  /** Vacío cuando el corte entero está suprimido. */
  preguntas: SurveyQuestionMetric[];
}

export type SurveyFlowEtapaVentana = {
  etapa: CompetitionStage;
  ventana: SurveyWindow;
} & CorteEncuesta;

export type SurveyFlowDisciplina = {
  disciplineId: string | null;
  disciplina: string | null;
  disciplineType: DisciplineType;
} & CorteEncuesta;

export type SurveyFlowDisciplinaLocalidad = {
  localityId: string | null;
  localidad: string | null;
  disciplineId: string | null;
  disciplina: string | null;
} & CorteEncuesta;

export interface SurveyFlowResult {
  campaignId: string;
  titulo: string;
  umbral: number;
  totalRespuestas: number;
  porEtapaVentana: SurveyFlowEtapaVentana[];
  porDisciplina: SurveyFlowDisciplina[];
  porDisciplinaYLocalidad: SurveyFlowDisciplinaLocalidad[];
}

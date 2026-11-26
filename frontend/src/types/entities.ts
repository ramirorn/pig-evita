// ===========================================
// Entidades
// ===========================================
import { UserRole, Sex, AgeCriterion, DisciplineType, ResultType, InscriptionStatus, DocumentType, DocumentStatus, CompetitionStage, CompetitionFormat, CompetitionStatus, MatchStatus } from './enums';

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

/**
 * Fila del listado de participantes (`GET /participants`): sólo lo que muestra
 * la tabla. Para editar se carga el detalle con `useParticipant(id)`.
 */
export type ParticipantListItem = Pick<
  Participant,
  'id' | 'dni' | 'firstName' | 'lastName' | 'birthDate' | 'sex' | 'locality' | 'department' | 'createdAt'
> & { age: number | null };

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
  /** Las categorías anteriores al criterio llegan como `AGE`. */
  ageCriterion: AgeCriterion;
  /** Rango por edad: sólo con `AGE`, `null` en el otro criterio. */
  minAge: number | null;
  maxAge: number | null;
  /** Rango por año de nacimiento: sólo con `BIRTH_YEAR`. */
  minBirthYear: number | null;
  maxBirthYear: number | null;
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
  category: Pick<
    Category,
    'id' | 'name' | 'ageCriterion' | 'minAge' | 'maxAge' | 'minBirthYear' | 'maxBirthYear' | 'sex'
  >;
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
    /** Sólo la inicial del apellido, por ejemplo "P." (VULN-32). */
    lastInitial: string;
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
  /** El listado por participante ya no la expone (O-7); sólo la usa el backend. */
  fileKey?: string;
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
  /**
   * Imagen lista para usar (pasala por `newsImageSrc`): ruta relativa a la
   * API (`/api/v1/news/<id>/image?v=…`) si se subió desde el panel, o la URL
   * `https` externa tal cual (pegada, o la del portal oficial). `null` si no
   * hay. La clave interna de MinIO (`imageKey`) no sale de la API.
   */
  imageUrl: string | null;
  /** De dónde viene la imagen: `'upload'` (archivo subido), `'url'` (externa), `null`. */
  imageSource: 'upload' | 'url' | null;
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

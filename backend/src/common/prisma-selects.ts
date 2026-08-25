// ===========================================
// Selects Prisma reutilizables
// ===========================================
import { Prisma } from '@prisma/client';

/**
 * Proyecciones compartidas entre módulos (hallazgos Q2, Q9, Q11, Q17).
 *
 * Varios services traían entidades completas con `include: { x: true }` cuando la
 * UI usa tres o cuatro campos. Además de payload de más, `include` arrastra
 * columnas nuevas automáticamente: si mañana `Participant` suma un campo
 * sensible, aparece solo en todas las respuestas. Con `select` explícito, agregar
 * un campo es una decisión.
 *
 * Tenerlos acá evita el *drift*: que el mismo dato se proyecte distinto según el
 * módulo que lo pida.
 */

/** Usuario del back-office mostrado como autor de una acción. */
export const USER_SUMMARY = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

/**
 * Participante reducido a su identidad visible: nombre y apellido.
 *
 * Es el mínimo para widgets donde el participante se muestra pero no se busca
 * ni se identifica formalmente (por ejemplo el listado de "últimas
 * inscripciones" del dashboard). Sin DNI: ese dato es identificatorio y no hay
 * motivo para pasearlo por una tarjeta de resumen.
 */
export const PARTICIPANT_NAME = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.ParticipantSelect;

/**
 * Participante en listados. Incluye DNI porque las tablas admin lo muestran y
 * es el dato por el que se busca.
 *
 * ⚠️ No agregar acá email, teléfono, dirección ni fecha de nacimiento: este
 * select se usa en respuestas de lista. Para la vista de detalle existe
 * `PARTICIPANT_CONTACT`.
 */
export const PARTICIPANT_SUMMARY = {
  ...PARTICIPANT_NAME,
  dni: true,
} satisfies Prisma.ParticipantSelect;

/** Participante en vistas de detalle, donde sí se muestran datos de contacto. */
export const PARTICIPANT_CONTACT = {
  ...PARTICIPANT_SUMMARY,
  birthDate: true,
  sex: true,
  locality: true,
  department: true,
  email: true,
  phone: true,
} satisfies Prisma.ParticipantSelect;

/** Disciplina reducida a lo que necesitan encabezados y validaciones de cupo. */
export const DISCIPLINE_SUMMARY = {
  id: true,
  name: true,
  minPlayers: true,
  maxPlayers: true,
} satisfies Prisma.DisciplineSelect;

/** Categoría reducida a su etiqueta, para chips y listados de resumen. */
export const CATEGORY_NAME = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

/** Categoría con su disciplina: el par que la UI muestra casi siempre junto. */
export const CATEGORY_WITH_DISCIPLINE = {
  id: true,
  name: true,
  sex: true,
  minAge: true,
  maxAge: true,
  discipline: { select: DISCIPLINE_SUMMARY },
} satisfies Prisma.CategorySelect;

/** Equipo referenciado desde otra entidad. */
export const TEAM_SUMMARY = {
  id: true,
  name: true,
} satisfies Prisma.TeamSelect;

/** Integrante de equipo con los datos que muestra la tabla del plantel. */
export const TEAM_MEMBER_WITH_PARTICIPANT = {
  id: true,
  position: true,
  shirtNumber: true,
  isCaptain: true,
  participantId: true,
  participant: { select: PARTICIPANT_SUMMARY },
} satisfies Prisma.TeamMemberSelect;

// -------------------------------------------------
// Proyecciones del fixture público (R01)
// -------------------------------------------------

/**
 * Sede tal como se la nombra dentro de un fixture público.
 *
 * Sin `address`: en el fixture alcanza con el nombre y la localidad para
 * ubicar el partido. La dirección completa se sirve por `GET /venues/:id`,
 * que es el endpoint que existe para mapas. Traerla acá sólo agregaba
 * superficie a una respuesta que además arrastra participantes.
 */
export const VENUE_PUBLIC_SUMMARY = {
  id: true,
  name: true,
  locality: true,
  department: true,
} satisfies Prisma.VenueSelect;

/**
 * Resultado de un partido en la vista pública: quién compitió y cómo salió.
 *
 * El participante entra con `PARTICIPANT_NAME` —nombre y apellido, nada más—.
 * Antes se traía con `include: { participant: true }`, o sea la ficha entera:
 * DNI, fecha de nacimiento, email, teléfono y domicilio de menores de edad,
 * servidos sin token.
 */
export const RESULT_PUBLIC = {
  id: true,
  matchId: true,
  teamId: true,
  participantId: true,
  scoreData: true,
  ranking: true,
  isWinner: true,
  // R23 — sin este campo la UI infería la localía del orden de las filas, que
  // Postgres no garantiza.
  isHome: true,
  team: { select: TEAM_SUMMARY },
  participant: { select: PARTICIPANT_NAME },
} satisfies Prisma.ResultSelect;

/**
 * Partido dentro de un fixture público.
 *
 * Sin `notes`: es el campo de observaciones internas del back-office (motivos
 * de reprogramación, comentarios sobre los equipos) y no tiene por qué salir
 * a la web.
 */
export const MATCH_PUBLIC = {
  id: true,
  competitionId: true,
  venueId: true,
  round: true,
  matchNumber: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  finishedAt: true,
  venue: { select: VENUE_PUBLIC_SUMMARY },
  // El `orderBy` es parte del contrato, no un detalle (R23): sin él, dos
  // refetchs del mismo partido pueden devolver las filas en distinto orden y la
  // pantalla invierte los lados. `isHome` desc pone al local primero —Postgres
  // ordena NULLS FIRST en desc, así que se desempata por `createdAt` para que
  // las disciplinas individuales, donde `isHome` es null en todas las filas,
  // también tengan un orden estable.
  results: {
    select: RESULT_PUBLIC,
    orderBy: [{ isHome: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.MatchSelect;

/**
 * Disciplina dentro de una competencia.
 *
 * Suma `type` y `resultType` a `DISCIPLINE_SUMMARY` porque la vista de fixture
 * los necesita para saber qué clave de `scoreData` leer al pintar el marcador.
 * No incluye `rules`, que es un HTML largo y no se muestra en esa pantalla.
 */
export const DISCIPLINE_IN_COMPETITION = {
  ...DISCIPLINE_SUMMARY,
  type: true,
  resultType: true,
} satisfies Prisma.DisciplineSelect;

/** Categoría dentro de una competencia: la etiqueta y el rango que la define. */
export const CATEGORY_IN_COMPETITION = {
  id: true,
  name: true,
  sex: true,
  minAge: true,
  maxAge: true,
} satisfies Prisma.CategorySelect;

/** Competencia con su fixture, tal como la sirve el endpoint público. */
export const COMPETITION_PUBLIC_DETAIL = {
  id: true,
  disciplineId: true,
  categoryId: true,
  stage: true,
  format: true,
  status: true,
  name: true,
  startDate: true,
  endDate: true,
  config: true,
  createdAt: true,
  updatedAt: true,
  discipline: { select: DISCIPLINE_IN_COMPETITION },
  category: { select: CATEGORY_IN_COMPETITION },
} satisfies Prisma.CompetitionSelect;

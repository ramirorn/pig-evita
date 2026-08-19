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
 * Participante en listados. Incluye DNI porque las tablas admin lo muestran y
 * es el dato por el que se busca.
 *
 * ⚠️ No agregar acá email, teléfono, dirección ni fecha de nacimiento: este
 * select se usa en respuestas de lista. Para la vista de detalle existe
 * `PARTICIPANT_CONTACT`.
 */
export const PARTICIPANT_SUMMARY = {
  id: true,
  firstName: true,
  lastName: true,
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

// ===========================================
// Schemas de equipos y alta de plantel
// ===========================================
import { z } from 'zod';
import { MAX_NOMBRE_LUGAR, textoObligatorio, textoOpcional } from './_helpers';
import { participantSchema } from './participants';

// ==========================================
// Team Schemas
// ==========================================

/** Nombre de equipo/club/escuela. */
const MAX_NOMBRE_EQUIPO = 60;

export const teamSchema = z.object({
  name: textoObligatorio(3, MAX_NOMBRE_EQUIPO, 'El nombre del equipo es obligatorio', 'El nombre del equipo'),
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
});

// ==========================================
// Team Inscription Schemas (alta de plantel completo)
// ==========================================

/** "Arquero", "Base", "Punta receptora": ninguna posición real pasa de 40. */
const MAX_POSICION = 40;

/** Dorsal. Mismo techo que el DTO del backend: `@Max(999)` en `CreateTeamMemberInscriptionDto`. */
const MAX_DORSAL = 999;

/**
 * Un integrante del plantel: **los mismos datos de una persona** que pide
 * `participantSchema`, más lo que sólo tiene sentido dentro de un equipo.
 *
 * Se extiende en vez de copiarse para que las reglas duras del participante
 * (formato de DNI, dígitos repetidos, fecha de nacimiento fuera del calendario)
 * valgan igual para el chico número 14 de un plantel que para una inscripción
 * individual. Cuando T15 endureció `participantSchema`, el camino de entrada
 * que lo reimplementaba a mano se quedó atrás (R31): esto es para no repetirlo.
 */
export const teamMemberSchema = participantSchema.extend({
  isSubstitute: z.boolean(),
  position: textoOpcional(MAX_POSICION, 'La posición'),
  shirtNumber: z
    .number()
    .int('El número de camiseta debe ser un número entero')
    .min(0, 'El número de camiseta no puede ser negativo')
    .max(MAX_DORSAL, `El número de camiseta no puede superar ${MAX_DORSAL}`)
    .nullish(),
  isCaptain: z.boolean(),
});

export type TeamMemberValues = z.infer<typeof teamMemberSchema>;

/**
 * El envío completo de `POST /inscriptions/team`.
 *
 * No valida el **conteo** del plantel (titulares y suplentes contra lo que pide
 * la disciplina) ni los duplicados de DNI: eso depende de la disciplina y la
 * categoría elegidas, que no están acá adentro. Vive en `rosterModel.ts`, que
 * es lo que el contador de la pantalla usa en vivo.
 */
export const teamInscriptionSchema = z.object({
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  teamName: textoObligatorio(
    3,
    MAX_NOMBRE_EQUIPO,
    'El nombre del equipo es obligatorio',
    'El nombre del equipo',
  ),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  members: z.array(teamMemberSchema).min(1, 'El plantel no puede estar vacío'),
});

export type TeamInscriptionValues = z.infer<typeof teamInscriptionSchema>;

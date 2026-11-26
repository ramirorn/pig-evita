// ===========================================
// Schemas de competencias
// ===========================================
import { z } from 'zod';
import { CompetitionStage, CompetitionFormat } from '@/types';
import { textoOpcional, fechaOpcional } from './_helpers';

// ==========================================
// Competition Schemas
// ==========================================

/** "Final Provincial de Vóley Sub-16 Femenino 2026" entra en 100. */
const MAX_NOMBRE_COMPETENCIA = 100;

export const competitionSchema = z
  .object({
    disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
    categoryId: z.string().uuid('Debe seleccionar una categoría'),
    stage: z.nativeEnum(CompetitionStage),
    format: z.nativeEnum(CompetitionFormat),
    name: textoOpcional(MAX_NOMBRE_COMPETENCIA, 'El nombre'),
    startDate: fechaOpcional('La fecha de inicio no existe en el calendario. Revisá el día y el mes.'),
    endDate: fechaOpcional('La fecha de fin no existe en el calendario. Revisá el día y el mes.'),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  });

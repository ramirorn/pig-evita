// ===========================================
// Schemas del calendario
// ===========================================
import { z } from 'zod';
import { CompetitionStage } from '@/types';
import { MAX_TEXTO_LARGO, textoObligatorio, nullishAVacio, textoOpcional, ISO_TIME_REGEX, esFechaDeCalendario, fechaOpcional } from './_helpers';

// ==========================================
// Calendar Event Schemas
// ==========================================

/** Título de evento del calendario público: cabe en una tarjeta sin truncar feo. */
const MAX_TITULO_EVENTO = 150;

export const calendarEventSchema = z
  .object({
    title: textoObligatorio(2, MAX_TITULO_EVENTO, 'El título es obligatorio', 'El título'),
    // `description` es `@db.Text`: sin límite de columna.
    description: textoOpcional(MAX_TEXTO_LARGO, 'La descripción'),
    startDate: z
      .string()
      .trim()
      .min(1, 'La fecha de inicio es obligatoria')
      .refine(esFechaDeCalendario, 'La fecha de inicio no existe en el calendario. Revisá el día y el mes.'),
    startTime: z
      .string()
      .trim()
      .min(1, 'La hora de inicio es obligatoria')
      .regex(ISO_TIME_REGEX, 'La hora de inicio debe tener el formato HH:MM (por ejemplo 09:30)'),
    hasEndDate: z.boolean().default(false),
    endDate: fechaOpcional('La fecha de fin no existe en el calendario. Revisá el día y el mes.'),
    endTime: z
      .preprocess(
        nullishAVacio,
        z
          .string()
          .trim()
          .refine(
            (valor) => valor === '' || ISO_TIME_REGEX.test(valor),
            'La hora de fin debe tener el formato HH:MM (por ejemplo 18:00)',
          )
          .transform((valor) => (valor === '' ? undefined : valor)),
      )
      .optional(),
    stage: z.nativeEnum(CompetitionStage).optional().nullable().or(z.literal('')).or(z.literal('none')),
    disciplineId: z.string().optional().nullable().or(z.literal('')),
    venueId: z.string().optional().nullable().or(z.literal('')),
    isPublished: z.boolean().default(true),
  })
  // Si el usuario tildó "tiene fecha de fin", la fecha de fin pasa a ser
  // obligatoria: antes se enviaba `endDate: null` en silencio.
  .refine((data) => !data.hasEndDate || Boolean(data.endDate), {
    message: 'Indicá la fecha de fin o destildá la opción',
    path: ['endDate'],
  })
  // El formulario arma `startDate + startTime` y `endDate + endTime` antes de
  // enviar, así que la comparación tiene que ser sobre el instante completo:
  // un evento del 10/03 09:00 al 10/03 08:00 es inválido aunque el día coincida.
  .refine(
    (data) => {
      if (!data.hasEndDate || !data.endDate) return true;
      const inicio = `${data.startDate}T${data.startTime}`;
      const fin = `${data.endDate}T${data.endTime ?? '23:59'}`;
      return fin >= inicio;
    },
    {
      message: 'El fin del evento no puede ser anterior al inicio',
      path: ['endDate'],
    },
  );

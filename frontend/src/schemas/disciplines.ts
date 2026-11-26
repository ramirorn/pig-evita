// ===========================================
// Schemas de disciplinas
// ===========================================
import { z } from 'zod';
import { DisciplineType, ResultType } from '@/types';
import { MAX_TEXTO_LARGO, textoObligatorio, textoOpcional } from './_helpers';

// ==========================================
// Discipline Schemas
// ==========================================

/** "Handball de playa femenino" no llega a 80. */
const MAX_NOMBRE_DISCIPLINA = 80;

/**
 * Tope de jugadores por equipo. La disciplina más numerosa del programa es
 * fútbol 11 (11 + suplentes); 50 deja margen para plantel ampliado sin dejar
 * pasar un `999` de tipeo.
 */
const MAX_JUGADORES_EQUIPO = 50;

export const disciplineSchema = z
  .object({
    name: textoObligatorio(3, MAX_NOMBRE_DISCIPLINA, 'El nombre debe tener al menos 3 caracteres', 'El nombre'),
    type: z.nativeEnum(DisciplineType),
    resultType: z.nativeEnum(ResultType),
    // `rules` es `@db.Text` (reglamento completo). Sólo se acota por el límite
    // del body parser, no por el dominio.
    rules: textoOpcional(MAX_TEXTO_LARGO, 'El reglamento'),
    minPlayers: z
      .number()
      .int('La cantidad de jugadores debe ser un número entero')
      .min(1, 'El mínimo de jugadores debe ser al menos 1')
      .max(MAX_JUGADORES_EQUIPO, `El mínimo de jugadores no puede superar ${MAX_JUGADORES_EQUIPO}`)
      .optional(),
    maxPlayers: z
      .number()
      .int('La cantidad de jugadores debe ser un número entero')
      .min(1, 'El máximo de jugadores debe ser al menos 1')
      .max(MAX_JUGADORES_EQUIPO, `El máximo de jugadores no puede superar ${MAX_JUGADORES_EQUIPO}`)
      .optional(),
    /**
     * Plantel reglamentario, sólo para disciplinas de `EQUIPO`.
     *
     * Van `nullish` porque así viajan: el backend los devuelve en `null` para
     * las individuales y para las de equipo que todavía nadie configuró. El
     * `superRefine` de abajo es el que impide guardar una disciplina de equipo
     * sin ellos, que es la única forma de que el alta de plantel completo
     * pueda usarse con esa disciplina.
     */
    titulares: z
      .number()
      .int('La cantidad de titulares debe ser un número entero')
      .min(1, 'Un equipo necesita al menos 1 titular')
      .max(MAX_JUGADORES_EQUIPO, `Los titulares no pueden superar ${MAX_JUGADORES_EQUIPO}`)
      .nullish(),
    maxSuplentes: z
      .number()
      .int('La cantidad de suplentes debe ser un número entero')
      .min(0, 'El máximo de suplentes no puede ser negativo')
      .max(MAX_JUGADORES_EQUIPO, `Los suplentes no pueden superar ${MAX_JUGADORES_EQUIPO}`)
      .nullish(),
    // Orden de visualización en el listado público: sólo se usa para ordenar,
    // no admite negativos ni valores absurdos.
    sortOrder: z
      .number()
      .int('El orden debe ser un número entero')
      .min(0, 'El orden no puede ser negativo')
      .max(999, 'El orden no puede superar 999')
      .default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.minPlayers === undefined ||
      data.maxPlayers === undefined ||
      data.maxPlayers >= data.minPlayers,
    {
      message: 'El máximo de jugadores debe ser mayor o igual al mínimo',
      path: ['maxPlayers'],
    },
  )
  .superRefine((data, ctx) => {
    // Sólo las de equipo tienen plantel. En una individual los dos campos ni
    // siquiera se muestran, y si llegaran con valor no significarían nada.
    if (data.type !== DisciplineType.EQUIPO) return;

    if (data.titulares === null || data.titulares === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['titulares'],
        message:
          'Una disciplina de equipo necesita saber cuántos titulares lleva: sin este dato no se puede inscribir un plantel.',
      });
    }
    if (data.maxSuplentes === null || data.maxSuplentes === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxSuplentes'],
        message:
          'Indicá cuántos suplentes admite la disciplina. Si no admite ninguno, poné 0.',
      });
    }
  });

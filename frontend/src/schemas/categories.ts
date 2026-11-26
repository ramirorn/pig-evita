// ===========================================
// Schemas de categorías
// ===========================================
import { z } from 'zod';
import { AgeCriterion, Sex } from '@/types';
import { textoObligatorio } from './_helpers';
import { ANIO_MINIMO_NACIMIENTO, EDAD_MINIMA_PARTICIPANTE } from './participants';

// ==========================================
// Category Schemas
// ==========================================

/** "Sub-14 Masculino Promocional" entra en 50. */
const MAX_NOMBRE_CATEGORIA = 50;

/** Techo de edad de una categoría: los Juegos Evita tienen rama adultos mayores. */
const EDAD_MAXIMA_CATEGORIA = 99;

/**
 * Un número del formulario o `null` (input vacío / criterio no elegido). El
 * rango se exige en `superRefine` según el criterio, no acá: el par del
 * criterio que no se usa queda en `null` y no tiene que validar.
 */
const enteroOpcional = (mensaje: string) => z.number().int(mensaje).nullable();

export const categorySchema = z
  .object({
    disciplineId: z.string().uuid('ID de disciplina inválido'),
    name: textoObligatorio(
      2,
      MAX_NOMBRE_CATEGORIA,
      'El nombre de categoría es obligatorio (ej. Sub 14)',
      'El nombre de categoría',
    ),
    ageCriterion: z.nativeEnum(AgeCriterion, { message: 'Elegí cómo se define la categoría' }),
    minAge: enteroOpcional('La edad mínima debe ser un número entero'),
    maxAge: enteroOpcional('La edad máxima debe ser un número entero'),
    minBirthYear: enteroOpcional('El año debe ser un número entero'),
    maxBirthYear: enteroOpcional('El año debe ser un número entero'),
    sex: z.nativeEnum(Sex),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const fuera = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (data.ageCriterion === AgeCriterion.BIRTH_YEAR) {
      // Mismos límites que `participantSchema.birthDate`: un año que ningún
      // participante válido puede tener deja la categoría vacía para siempre.
      const anioMaximo = new Date().getFullYear() - EDAD_MINIMA_PARTICIPANTE;
      const anios = [
        ['minBirthYear', data.minBirthYear, 'El año "desde"'],
        ['maxBirthYear', data.maxBirthYear, 'El año "hasta"'],
      ] as const;
      for (const [campo, valor, nombre] of anios) {
        if (valor === null) fuera(campo, `${nombre} es obligatorio`);
        else if (valor < ANIO_MINIMO_NACIMIENTO) fuera(campo, `${nombre} no puede ser anterior a ${ANIO_MINIMO_NACIMIENTO}`);
        else if (valor > anioMaximo) fuera(campo, `${nombre} no puede ser posterior a ${anioMaximo}`);
      }
      if (
        data.minBirthYear !== null &&
        data.maxBirthYear !== null &&
        data.maxBirthYear < data.minBirthYear
      ) {
        fuera('maxBirthYear', 'El año "hasta" debe ser igual o posterior al "desde"');
      }
      return;
    }

    // El piso es el mismo que el de `participantSchema.birthDate`: una
    // categoría no puede pedir una edad que ningún participante puede tener.
    const edades = [
      ['minAge', data.minAge, 'La edad mínima'],
      ['maxAge', data.maxAge, 'La edad máxima'],
    ] as const;
    for (const [campo, valor, nombre] of edades) {
      if (valor === null) fuera(campo, `${nombre} es obligatoria`);
      else if (valor < EDAD_MINIMA_PARTICIPANTE) fuera(campo, `${nombre} no puede ser menor a ${EDAD_MINIMA_PARTICIPANTE} años`);
      else if (valor > EDAD_MAXIMA_CATEGORIA) fuera(campo, `${nombre} no puede superar los ${EDAD_MAXIMA_CATEGORIA} años`);
    }
    if (data.minAge !== null && data.maxAge !== null && data.maxAge < data.minAge) {
      fuera('maxAge', 'La edad máxima debe ser mayor o igual a la mínima');
    }
  });

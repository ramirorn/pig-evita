// ===========================================
// categoryRange — quién entra en una categoría, por edad o por año
// ===========================================
//
// Una categoría define su rango de dos maneras (`AgeCriterion`): por edad
// cumplida al día de hoy o por año de nacimiento. La segunda existe porque el
// chico al que "le da la edad" para la Sub-14 pero cumple 15 ese mismo año
// compite en desventaja física. El backend (`categories/category-range.ts`)
// aplica la misma regla: si divergen, la pantalla dice "cumple" y el alta
// vuelve con un 400.
import { AgeCriterion, type Category } from '@/types';

/** Los campos de la categoría que definen el rango. */
export type CategoryRange = Pick<Category, 'minAge' | 'maxAge'> &
  Partial<Pick<Category, 'ageCriterion' | 'minBirthYear' | 'maxBirthYear'>>;

/**
 * Edad cumplida a la fecha de referencia. Una fecha `YYYY-MM-DD` se lee como
 * fecha local: `new Date('2012-03-05')` es medianoche UTC y en Argentina cae el
 * día anterior.
 */
export function calcularEdad(birthDate: string, referencia = new Date()): number | null {
  if (!birthDate) return null;
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const nacimiento = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(birthDate);
  if (Number.isNaN(nacimiento.getTime())) return null;

  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const meses = referencia.getMonth() - nacimiento.getMonth();
  if (meses < 0 || (meses === 0 && referencia.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

/** Año de nacimiento de una fecha `YYYY-MM-DD` (o ISO), sin pasar por zona horaria. */
export function anioDeNacimiento(birthDate: string): number | null {
  const anio = /^(\d{4})-/.exec(birthDate ?? '');
  return anio ? Number(anio[1]) : null;
}

/** Categorías sin `ageCriterion` (respuestas viejas, cachés) se leen por edad. */
export function esPorAnioDeNacimiento(category: CategoryRange): boolean {
  return category.ageCriterion === AgeCriterion.BIRTH_YEAR;
}

/** Etiqueta corta del rango: "12 a 14 años" o "Nacidos 2010 a 2012". */
export function formatCategoryRange(category: CategoryRange): string {
  return esPorAnioDeNacimiento(category)
    ? `Nacidos ${category.minBirthYear} a ${category.maxBirthYear}`
    : `${category.minAge} a ${category.maxAge} años`;
}

export interface EvaluacionRango {
  /** `null` cuando la fecha todavía no permite decidir. */
  ok: boolean | null;
  /** Lo que se comparó, para el mensaje: "tiene 13 años" / "nació en 2011". */
  dato: string;
}

/** ¿La fecha de nacimiento entra en el rango de la categoría? */
export function evaluarRango(
  category: CategoryRange,
  birthDate: string,
  referencia = new Date(),
): EvaluacionRango {
  if (esPorAnioDeNacimiento(category)) {
    const anio = anioDeNacimiento(birthDate);
    if (anio === null) return { ok: null, dato: '' };
    const ok =
      category.minBirthYear != null &&
      category.maxBirthYear != null &&
      anio >= category.minBirthYear &&
      anio <= category.maxBirthYear;
    return { ok, dato: `nació en ${anio}` };
  }

  const edad = calcularEdad(birthDate, referencia);
  if (edad === null) return { ok: null, dato: '' };
  const ok =
    category.minAge != null &&
    category.maxAge != null &&
    edad >= category.minAge &&
    edad <= category.maxAge;
  return { ok, dato: `tiene ${edad} años` };
}

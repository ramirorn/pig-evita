// ===========================================
// Rango de una categoría (edad o año de nacimiento)
// ===========================================
import { AgeCriterion } from '@prisma/client';

/** Los campos de una categoría que definen quién entra por edad. */
export interface CategoryRange {
  ageCriterion?: AgeCriterion | null;
  minAge: number | null;
  maxAge: number | null;
  minBirthYear?: number | null;
  maxBirthYear?: number | null;
}

/**
 * Edad cumplida a la fecha de referencia. Es el criterio de siempre del alta
 * individual y del plantel: dos cálculos distintos para la misma pregunta
 * harían que un chico entre por una puerta y no por la otra.
 */
export function calcularEdad(birthDate: Date, hoy = new Date()): number {
  let age = hoy.getFullYear() - birthDate.getFullYear();
  const monthDiff = hoy.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && hoy.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Año de nacimiento tal como se guardó. Las fechas de nacimiento son `@db.Date`
 * (medianoche UTC): leerlas en hora local corre el 1 de enero al año anterior.
 */
export function anioDeNacimiento(birthDate: Date): number {
  return birthDate.getUTCFullYear();
}

/** Categorías previas a `ageCriterion` se leen como lo que eran: por edad. */
export function esPorAnioDeNacimiento(category: CategoryRange): boolean {
  return category.ageCriterion === AgeCriterion.BIRTH_YEAR;
}

/** "de 12 a 14 años" o "nacidos de 2010 a 2012", para los mensajes de rechazo. */
export function describirRango(category: CategoryRange): string {
  return esPorAnioDeNacimiento(category)
    ? `nacidos de ${category.minBirthYear} a ${category.maxBirthYear}`
    : `de ${category.minAge} a ${category.maxAge} años`;
}

/**
 * ¿La persona entra en el rango de la categoría? Devuelve el dato que se
 * comparó (edad o año) para que el mensaje de rechazo diga lo mismo que se
 * validó.
 */
export function evaluarRango(
  category: CategoryRange,
  birthDate: Date,
  hoy = new Date(),
): { ok: boolean; dato: string } {
  if (esPorAnioDeNacimiento(category)) {
    const anio = anioDeNacimiento(birthDate);
    const ok =
      category.minBirthYear != null &&
      category.maxBirthYear != null &&
      anio >= category.minBirthYear &&
      anio <= category.maxBirthYear;
    return { ok, dato: `nació en ${anio}` };
  }

  const edad = calcularEdad(birthDate, hoy);
  const ok =
    category.minAge != null &&
    category.maxAge != null &&
    edad >= category.minAge &&
    edad <= category.maxAge;
  return { ok, dato: `tiene ${edad} años` };
}

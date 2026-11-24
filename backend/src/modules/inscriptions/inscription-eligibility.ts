// ===========================================
// Elegibilidad de una persona para una categoría
// ===========================================
//
// Reglas puras: no tocan la base ni lanzan excepciones de Nest. Devuelven el
// mensaje del rechazo (o `null` si la persona es elegible) y el service decide
// cómo responder. El alta individual y la de planteles usan el mismo criterio
// —`evaluarRango`: edad cumplida hoy, o año de nacimiento si la categoría es
// por año— porque dos criterios para la misma pregunta harían que un chico
// entre por una puerta y no por la otra.
import { Sex } from '@prisma/client';
import {
  CategoryRange,
  describirRango,
  evaluarRango,
} from '../categories/category-range';

/** Lo que hace falta de una categoría para decidir si alguien puede competir. */
export interface EligibilityCategory extends CategoryRange {
  name: string;
  sex: Sex;
}

/** Persona a evaluar: la del request o la ya guardada en el padrón. */
export interface EligibilityPerson {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  sex: Sex;
}

/**
 * De dónde salen los datos evaluados. Sólo cambia el texto: el mismo rechazo se
 * lee distinto si el dato vino en el request o si ya estaba en el padrón.
 */
export type EligibilitySource = 'payload' | 'registry';

/** Una categoría MIXTO admite cualquier sexo; las demás, sólo el propio. */
export function isSexAllowed(categorySex: Sex, personSex: Sex): boolean {
  return categorySex === Sex.MIXTO || categorySex === personSex;
}

/** Rechazo del alta individual, o `null` si la persona es elegible. */
export function individualEligibilityError(
  category: EligibilityCategory,
  birthDate: Date,
  sex: Sex,
  today = new Date(),
): string | null {
  const range = evaluarRango(category, birthDate, today);
  if (!range.ok) {
    return `El participante ${range.dato} y la categoría admite ${describirRango(category)}`;
  }
  if (!isSexAllowed(category.sex, sex)) {
    return `El sexo del participante no coincide con la categoría (${category.sex})`;
  }
  return null;
}

/** Rechazo de un integrante de plantel, o `null` si es elegible. */
export function memberEligibilityError(
  category: EligibilityCategory,
  person: EligibilityPerson,
  source: EligibilitySource = 'payload',
  today = new Date(),
): string | null {
  const who = `${person.firstName} ${person.lastName} (DNI ${person.dni})`;
  const basis =
    source === 'registry' ? ' según los datos cargados en el padrón' : '';

  const range = evaluarRango(category, person.birthDate, today);
  if (!range.ok) {
    return (
      `${who} ${range.dato}${basis} y la categoría ` +
      `"${category.name}" admite ${describirRango(category)}.`
    );
  }
  if (!isSexAllowed(category.sex, person.sex)) {
    return (
      `${who} es ${person.sex}${basis} y la categoría "${category.name}" ` +
      `es ${category.sex}.`
    );
  }
  return null;
}

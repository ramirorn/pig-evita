// ===========================================
// Reglas de composición de un plantel
// ===========================================
//
// Reglas puras del alta por equipo: no tocan la base ni lanzan excepciones de
// Nest. Devuelven el mensaje del rechazo (o `null`) y el service decide cómo
// responder. Se separan del service para poder probar cada regla sin armar una
// transacción ni un doble de Prisma.

/** Lo mínimo de un integrante que miran estas reglas. */
export interface RosterMember {
  dni: string;
  isSubstitute: boolean;
  isCaptain?: boolean;
}

/** Cupos del plantel según la disciplina. */
export interface RosterLimits {
  name: string;
  starters: number;
  maxSubstitutes: number;
}

/** Valores que aparecen más de una vez, sin repetirse ellos mismos. */
export function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/** Titulares y suplentes, en el orden en que vinieron. */
export function splitRoster<T extends RosterMember>(
  members: readonly T[],
): { starters: T[]; substitutes: T[] } {
  return {
    starters: members.filter((m) => !m.isSubstitute),
    substitutes: members.filter((m) => m.isSubstitute),
  };
}

/**
 * Consistencia interna del plantel, antes de mirar la base: cada DNI una sola
 * vez y como mucho un capitán.
 */
export function rosterConsistencyError(
  members: readonly RosterMember[],
): string | null {
  const duplicated = findDuplicates(members.map((m) => m.dni));
  if (duplicated.length > 0) {
    return (
      `El plantel tiene DNI repetidos: ${duplicated.join(', ')}. ` +
      'Cada integrante tiene que figurar una sola vez.'
    );
  }

  const captains = members.filter((m) => m.isCaptain === true).length;
  if (captains > 1) {
    return (
      `El plantel tiene ${captains} capitanes marcados. ` +
      'Como mucho puede haber uno.'
    );
  }

  return null;
}

/**
 * Tamaño del plantel contra lo que exige la disciplina: titulares exactos y
 * suplentes hasta el máximo.
 */
export function rosterSizeError(
  members: readonly RosterMember[],
  limits: RosterLimits,
): string | null {
  const { starters, substitutes } = splitRoster(members);

  if (starters.length !== limits.starters) {
    return (
      `"${limits.name}" exige exactamente ${limits.starters} titulares y ` +
      `el plantel trae ${starters.length}.`
    );
  }

  if (substitutes.length > limits.maxSubstitutes) {
    return (
      `"${limits.name}" admite hasta ${limits.maxSubstitutes} suplentes y el plantel ` +
      `trae ${substitutes.length}.`
    );
  }

  return null;
}

// ===========================================
// Mock de Prisma que RESPETA select/include
// ===========================================
/**
 * Un `jest.fn().mockResolvedValue(fila)` miente: devuelve la fila entera sin
 * importar el `select` que haya pedido el service. Con ese mock, un service que
 * arrastra PII por `include: { participant: true }` y otro que proyecta con
 * `select: PARTICIPANT_NAME` producen exactamente la misma respuesta, y el test
 * de fuga de datos pasa en los dos casos — o sea, no prueba nada.
 *
 * Este módulo modela el comportamiento real: aplica la proyección del query a
 * una fila "gorda" de fixture. Un service que no proyecta devuelve PII; uno que
 * proyecta, no. Es lo que hace que el barrido de endpoints públicos (R01) tenga
 * poder de detección.
 */

/** Claves que en el esquema son relaciones y que Prisma NO devuelve sin pedirlas. */
export const RELACIONES: Record<string, string[]> = {
  competition: ['discipline', 'category', 'matches'],
  match: ['competition', 'venue', 'results'],
  result: ['match', 'team', 'participant'],
  team: ['discipline', 'category', 'members', 'inscriptions', 'results'],
  teamMember: ['team', 'participant'],
  participant: ['inscriptions', 'documents', 'teamMembers', 'results'],
  category: ['discipline', 'inscriptions', 'teams', 'competitions'],
  discipline: ['categories', 'teams', 'competitions'],
  venue: ['matches'],
  news: ['author'],
  calendarEvent: ['venue', 'discipline'],
  inscription: ['participant', 'team', 'category', 'discipline', 'documents'],
  user: ['auditLogs'],
};

type Args = {
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
} & Record<string, unknown>;

/** Escalares de una fila: todo menos las relaciones declaradas del modelo. */
function escalares(fila: Record<string, any>, modelo: string) {
  const relaciones = new Set(RELACIONES[modelo] ?? []);
  const salida: Record<string, any> = {};
  for (const [k, v] of Object.entries(fila)) {
    if (!relaciones.has(k)) salida[k] = v;
  }
  return salida;
}

/** Aplica a un valor relacionado (objeto, array o null) la config anidada. */
function proyectarRelacion(valor: any, config: any, modelo: string): any {
  if (valor === null || valor === undefined) return valor ?? null;
  if (Array.isArray(valor)) {
    return valor.map((v) => proyectarRelacion(v, config, modelo));
  }
  if (config === true) {
    // `include: { x: true }` → la fila completa de la relación. Es justamente
    // el caso que filtraba PII.
    return escalares(valor, modelo);
  }
  return proyectar(valor, (config ?? {}) as Args, modelo);
}

/**
 * Proyecta una fila de fixture según los `select`/`include` del query.
 *
 * @param modelo nombre del modelo Prisma de `fila` (para saber qué claves son
 *               relaciones y por lo tanto no salen si nadie las pide).
 */
export function proyectar(
  fila: Record<string, any> | null,
  args: Args = {},
  modelo = '',
): Record<string, any> | null {
  if (!fila) return null;

  const { select, include } = args;

  if (select) {
    const salida: Record<string, any> = {};
    for (const [clave, config] of Object.entries(select)) {
      if (config === false || config === undefined) continue;
      if (clave === '_count') {
        salida._count = fila._count ?? {};
        continue;
      }
      const valor = fila[clave];
      const esRelacion = (RELACIONES[modelo] ?? []).includes(clave);
      if (esRelacion || (config !== true && typeof config === 'object')) {
        salida[clave] = proyectarRelacion(valor, config, modeloDe(clave));
      } else {
        salida[clave] = valor;
      }
    }
    return salida;
  }

  const salida = escalares(fila, modelo);

  if (include) {
    for (const [clave, config] of Object.entries(include)) {
      if (config === false || config === undefined) continue;
      if (clave === '_count') {
        salida._count = fila._count ?? {};
        continue;
      }
      salida[clave] = proyectarRelacion(fila[clave], config, modeloDe(clave));
    }
  }

  return salida;
}

/** Nombre del modelo al que apunta una clave de relación. */
function modeloDe(clave: string): string {
  const mapa: Record<string, string> = {
    discipline: 'discipline',
    categories: 'category',
    category: 'category',
    matches: 'match',
    match: 'match',
    results: 'result',
    result: 'result',
    venue: 'venue',
    team: 'team',
    members: 'teamMember',
    participant: 'participant',
    author: 'user',
    user: 'user',
    competitions: 'competition',
    competition: 'competition',
    inscriptions: 'inscription',
    documents: 'document',
  };
  return mapa[clave] ?? clave;
}

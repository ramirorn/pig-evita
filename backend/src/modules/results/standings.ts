// ===========================================
// Tabla de posiciones (F-12)
// ===========================================
//
// Funciones puras: quién ganó cada partido según `isWinner` y, si nadie lo
// marcó, según el marcador y el `resultType` de la disciplina; y cómo se
// ordena la tabla. Separadas del service para poder ejercitarlas sin Prisma.
import type { ResultType } from '@prisma/client';

/** Victoria 3, empate 1, derrota 0. */
export const PUNTOS_POR = { GANO: 3, EMPATO: 1, PERDIO: 0 } as const;
export type Desenlace = keyof typeof PUNTOS_POR;

/**
 * Claves de `scoreData` por tipo de resultado.
 *
 * La primera es la que escribe el panel (`frontend/.../matchScore.ts`); las
 * siguientes son alias en castellano que aparecen en datos cargados por API.
 */
const CLAVES: Record<ResultType, string[]> = {
  GOLES: ['goals', 'goles'],
  PUNTOS: ['points', 'puntos'],
  TIEMPO: ['time', 'tiempo'],
  SETS: ['sets'],
  POSICIONES: ['position', 'posicion'],
};

/** En TIEMPO y POSICIONES gana el número más chico. */
export function menorEsMejor(tipo: ResultType | null | undefined): boolean {
  return tipo === 'TIEMPO' || tipo === 'POSICIONES';
}

/** Lo que la tabla necesita de cada `Result`. */
export interface ResultadoDeTabla {
  teamId: string | null;
  participantId: string | null;
  isWinner: boolean | null;
  scoreData?: unknown;
  ranking?: number | null;
}

/** `"1:02.35"` → 62.35, `"10.52"` → 10.52, `7` → 7; lo ilegible → null. */
function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  const partes = valor.trim().split(':');
  let total = 0;
  for (const parte of partes) {
    const n = Number(parte.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    total = total * 60 + n;
  }
  return total;
}

function valorCrudo(r: ResultadoDeTabla, tipo: ResultType): unknown {
  const datos =
    r.scoreData && typeof r.scoreData === 'object'
      ? (r.scoreData as Record<string, unknown>)
      : {};
  for (const clave of CLAVES[tipo]) {
    if (datos[clave] !== undefined && datos[clave] !== null)
      return datos[clave];
  }
  // En POSICIONES el puesto también puede venir en la columna `ranking`.
  if (tipo === 'POSICIONES') return r.ranking ?? null;
  return null;
}

/**
 * Marcador numérico de cada resultado del partido, o `null` si alguno no se
 * puede leer.
 *
 * SETS admite el total de sets ganados (`{ sets: 3 }`) o los parciales
 * (`{ sets: [25, 20, 25] }`); con parciales y dos competidores se cuentan los
 * sets ganados comparando parcial contra parcial.
 */
export function marcadores(
  resultados: readonly ResultadoDeTabla[],
  tipo: ResultType | null | undefined,
): number[] | null {
  if (!tipo) return null;
  const crudos = resultados.map((r) => valorCrudo(r, tipo));

  if (tipo === 'SETS' && crudos.some(Array.isArray)) {
    if (crudos.length !== 2 || !crudos.every(Array.isArray)) return null;
    const [a, b] = crudos as unknown[][];
    let ganadosA = 0;
    let ganadosB = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = aNumero(a[i]);
      const y = aNumero(b[i]);
      if (x === null || y === null) return null;
      if (x > y) ganadosA++;
      else if (y > x) ganadosB++;
    }
    return [ganadosA, ganadosB];
  }

  const valores = crudos.map(aNumero);
  return valores.every((v): v is number => v !== null) ? valores : null;
}

/**
 * Desenlace de cada resultado del partido, en el mismo orden.
 *
 * 1. Si alguien tiene `isWinner`, gana él y el resto pierde.
 * 2. Si nadie lo tiene, decide el marcador según el `resultType`.
 * 3. Sin marcador legible, o con marcadores iguales, es empate (F-12: antes
 *    los dos sumaban una derrota). Con más de dos competidores, los empatados
 *    en el mejor marcador empatan y el resto pierde.
 */
export function desenlaces(
  resultados: readonly ResultadoDeTabla[],
  tipo: ResultType | null | undefined,
): Desenlace[] {
  if (resultados.some((r) => r.isWinner === true)) {
    return resultados.map((r) => (r.isWinner === true ? 'GANO' : 'PERDIO'));
  }

  const valores = marcadores(resultados, tipo);
  if (!valores) return resultados.map(() => 'EMPATO');

  const mejor = menorEsMejor(tipo)
    ? Math.min(...valores)
    : Math.max(...valores);
  const enLaPunta = valores.filter((v) => v === mejor).length;
  if (enLaPunta === valores.length) return resultados.map(() => 'EMPATO');
  return valores.map((v) =>
    v !== mejor ? 'PERDIO' : enLaPunta === 1 ? 'GANO' : 'EMPATO',
  );
}

/** Una fila de la tabla. `group` sólo aparece en FASE_GRUPOS. */
export interface FilaDeTabla {
  position: number;
  id: string;
  name: string;
  teamId: string | null;
  participantId: string | null;
  group?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  /** Suma del marcador propio (goles, puntos, sets ganados, tiempo, puesto). */
  scoreFor: number;
  /** Suma del marcador del rival, en partidos de dos. */
  scoreAgainst: number;
}

/**
 * Criterio de orden: puntos, victorias, menos derrotas y después el marcador
 * —diferencia a favor cuando más es mejor, total más bajo en TIEMPO y
 * POSICIONES—; el nombre al final deja el orden estable entre iguales.
 */
export function compararFilas(tipo: ResultType | null | undefined) {
  return (a: FilaDeTabla, b: FilaDeTabla): number =>
    b.points - a.points ||
    b.won - a.won ||
    a.lost - b.lost ||
    (menorEsMejor(tipo)
      ? a.scoreFor - b.scoreFor
      : b.scoreFor - b.scoreAgainst - (a.scoreFor - a.scoreAgainst) ||
        b.scoreFor - a.scoreFor) ||
    a.name.localeCompare(b.name, 'es');
}

/**
 * Grupo de cada competidor en una fase de grupos, deducido del fixture.
 *
 * Cada grupo es un todos contra todos cerrado: dos competidores están en el
 * mismo grupo si y sólo si hay un camino de partidos entre ellos. Se etiquetan
 * A, B, C… por el orden en que aparecen (fecha y número de partido), que es el
 * orden en que `crucesFaseDeGrupos` los escribe.
 */
export function gruposDelFixture(
  partidos: ReadonlyArray<{
    results: ReadonlyArray<{
      teamId: string | null;
      participantId: string | null;
    }>;
  }>,
): Map<string, string> {
  const padre = new Map<string, string>();
  const raiz = (x: string): string => {
    let r = x;
    while (padre.get(r) !== r) r = padre.get(r)!;
    padre.set(x, r);
    return r;
  };
  const orden: string[] = [];

  for (const partido of partidos) {
    const ids = partido.results
      .map((r) => r.teamId ?? r.participantId)
      .filter((id): id is string => Boolean(id));
    for (const id of ids) {
      if (!padre.has(id)) {
        padre.set(id, id);
        orden.push(id);
      }
    }
    for (const id of ids.slice(1)) padre.set(raiz(id), raiz(ids[0]));
  }

  const etiquetas = new Map<string, string>();
  const salida = new Map<string, string>();
  for (const id of orden) {
    const r = raiz(id);
    if (!etiquetas.has(r)) {
      const n = etiquetas.size;
      etiquetas.set(r, n < 26 ? String.fromCharCode(65 + n) : String(n + 1));
    }
    salida.set(id, etiquetas.get(r)!);
  }
  return salida;
}

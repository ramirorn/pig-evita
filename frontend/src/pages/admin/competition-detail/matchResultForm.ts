// ===========================================
// Carga de resultados: de lo que tipea el usuario al payload del backend
// ===========================================
import type { MatchResultPayload } from '@/api/results.api';
import { ResultType, type Result } from '@/types';
import { CLAVE_POR_TIPO } from './matchScore';

/**
 * Cómo se lee cada tipo de resultado (F-32).
 *
 * `mayorGana` decide quién gana: en goles, puntos y sets gana el número más
 * alto; en tiempo y posiciones, el más bajo. `entero` decide qué valida el
 * campo: los tiempos se escriben como `1:02.35` o `62.35`, el resto son enteros.
 */
const REGLAS: Record<ResultType, { etiqueta: string; mayorGana: boolean; entero: boolean }> = {
  [ResultType.GOLES]: { etiqueta: 'Goles', mayorGana: true, entero: true },
  [ResultType.PUNTOS]: { etiqueta: 'Puntos', mayorGana: true, entero: true },
  [ResultType.SETS]: { etiqueta: 'Sets ganados', mayorGana: true, entero: true },
  [ResultType.TIEMPO]: { etiqueta: 'Tiempo (m:ss.cc o segundos)', mayorGana: false, entero: false },
  [ResultType.POSICIONES]: { etiqueta: 'Posición', mayorGana: false, entero: true },
};

/** Si la disciplina no informó su tipo, se cargan puntos: es el caso neutro. */
export function reglaDe(tipo: ResultType | undefined) {
  return REGLAS[tipo ?? ResultType.PUNTOS];
}

/**
 * Convierte un tiempo escrito a segundos. Acepta `62.35`, `1:02.35` y
 * `1:01:02.35`. Devuelve `null` si no se puede leer.
 */
export function tiempoEnSegundos(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(limpio)) return null;
  return limpio
    .split(':')
    .reduce((total, parte) => total * 60 + Number(parte), 0);
}

/** Valor numérico comparable del campo, o `null` si es inválido. */
function valorComparable(texto: string, tipo: ResultType | undefined): number | null {
  const regla = reglaDe(tipo);
  if (!regla.entero) return tiempoEnSegundos(texto);
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  if (tipo === ResultType.POSICIONES && n < 1) return null;
  return n;
}

/** Texto inicial del campo a partir de lo que ya está cargado. */
export function valorInicial(resultado: Result, tipo: ResultType | undefined): string {
  const valor = resultado.scoreData?.[CLAVE_POR_TIPO[tipo ?? ResultType.PUNTOS]];
  if (Array.isArray(valor)) return String(valor.length);
  if (typeof valor === 'number' || typeof valor === 'string') return String(valor);
  return '';
}

export type ArmadoDeResultado =
  | { ok: true; payload: MatchResultPayload[] }
  | { ok: false; error: string };

/**
 * Arma el `PATCH /results/match/:id` (un `MatchResultDto` por competidor).
 *
 * El ganador se deduce del marcador: el mejor valor, si es único. Un empate
 * en el mejor valor deja a todos con `isWinner: false`, que es como el backend
 * representa el empate en el ranking.
 */
export function armarResultado(
  resultados: Result[],
  valores: Record<string, string>,
  tipo: ResultType | undefined,
): ArmadoDeResultado {
  if (resultados.length === 0) {
    return { ok: false, error: 'El partido no tiene competidores para cargar.' };
  }

  const regla = reglaDe(tipo);
  const clave = CLAVE_POR_TIPO[tipo ?? ResultType.PUNTOS];
  const comparables: number[] = [];

  for (const r of resultados) {
    const texto = valores[r.id] ?? '';
    const n = valorComparable(texto, tipo);
    if (n === null) {
      return {
        ok: false,
        error: regla.entero
          ? `Completá ${regla.etiqueta.toLowerCase()} de cada competidor con un número entero${tipo === ResultType.POSICIONES ? ' mayor que 0' : ''}.`
          : 'Completá el tiempo de cada competidor (por ejemplo 1:02.35 o 62.35).',
      };
    }
    comparables.push(n);
  }

  const mejor = regla.mayorGana ? Math.max(...comparables) : Math.min(...comparables);
  const hayEmpateArriba = comparables.filter((n) => n === mejor).length > 1;

  const payload = resultados.map((r, i) => {
    const texto = (valores[r.id] ?? '').trim();
    const comparable = comparables[i]!;
    const scoreData = { [clave]: regla.entero ? comparable : texto };
    return {
      resultId: r.id,
      data: {
        scoreData,
        ...(tipo === ResultType.POSICIONES ? { ranking: comparable } : {}),
        isWinner: !hayEmpateArriba && comparable === mejor,
      },
    };
  });

  return { ok: true, payload };
}

// ===========================================
// Lectura del marcador de un resultado
// ===========================================
import { ResultType, type Result } from '@/types';

/**
 * Clave de `scoreData` que corresponde a cada tipo de resultado.
 *
 * `Result.scoreData` es un `Json` libre y su forma la define la disciplina:
 * `{ goals: 3 }`, `{ time: "10.52" }`, `{ sets: [25, 20, 25] }`, `{ points: 1 }`
 * (ver el comentario del modelo `Result` en `schema.prisma`).
 *
 * Antes la tarjeta del partido mostraba `Object.values(scoreData)[0]`, o sea que
 * **el marcador dependía del orden de las claves del JSON**: si el backend
 * pasaba de `{ goals: 3 }` a `{ cards: 1, goals: 3 }`, la pantalla mostraba `1`
 * sin que nada fallara. Leer por clave explícita convierte ese modo de falla
 * silencioso en un guion visible.
 */
const CLAVE_POR_TIPO: Record<ResultType, string> = {
  [ResultType.GOLES]: 'goals',
  [ResultType.PUNTOS]: 'points',
  [ResultType.TIEMPO]: 'time',
  [ResultType.SETS]: 'sets',
  [ResultType.POSICIONES]: 'position',
};

/** Lo que se muestra cuando no hay un marcador legible. */
export const SIN_MARCADOR = '-';

/**
 * Devuelve el marcador de un resultado como texto, según el tipo de resultado
 * de la disciplina.
 *
 * Si el dato no está o no tiene la forma esperada devuelve `SIN_MARCADOR`: es
 * preferible un guion a un número tomado de otra clave, que se lee como si fuera
 * el marcador real.
 *
 * @param resultado El resultado del equipo o participante; puede faltar.
 * @param tipo      `resultType` de la disciplina; si no llegó, no se adivina.
 */
export function formatearMarcador(
  resultado: Result | undefined,
  tipo: ResultType | undefined,
): string {
  if (!resultado?.scoreData || !tipo) return SIN_MARCADOR;

  const valor = resultado.scoreData[CLAVE_POR_TIPO[tipo]];

  if (valor === undefined || valor === null) return SIN_MARCADOR;

  // SETS llega como arreglo de parciales (`[25, 20, 25]`). En la tarjeta del
  // fixture interesa cuántos sets ganó, no el detalle de cada uno: eso va en la
  // vista de resultados.
  if (Array.isArray(valor)) {
    return valor.length > 0 ? String(valor.length) : SIN_MARCADOR;
  }

  if (typeof valor === 'number' || typeof valor === 'string') {
    return String(valor);
  }

  return SIN_MARCADOR;
}

// ===========================================
// rankingRowKey — identidad estable de una fila de la tabla de posiciones
// ===========================================
import type { RankingEntry } from '@/api/results.api';

/**
 * Devuelve la `key` de React de una fila del ranking.
 *
 * La `key` era el índice del `map`, y esta tabla **reordena**: al cargarse los
 * resultados de una fecha, el que estaba tercero pasa a primero. Con
 * `key={idx}` React entiende "la fila 0 sigue siendo la fila 0" y reusa el DOM
 * por posición en vez de moverlo (R31).
 *
 * El backend manda en `id` el del equipo o el del participante, según la
 * disciplina (F-33: antes se leían `teamId`/`participantId`, que la API nunca
 * devolvió). La posición es el último recurso: es única dentro de la tabla,
 * aunque no sobreviva al reordenamiento.
 */
export function rankingRowKey(entry: RankingEntry, indice: number): string {
  return entry.id || `pos-${entry.position ?? indice + 1}`;
}

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
 * por posición en vez de moverlo. Con celdas de texto plano el daño es
 * cosmético, pero es la misma tabla cuya correctitud se acaba de endurecer en
 * `matchScore.ts`, y alcanza con que alguien agregue una animación de entrada o
 * un `<input>` para que deje de serlo (R31).
 *
 * El backend manda `teamId` o `participantId` según el formato de la
 * competencia. `position` es el último recurso: sigue siendo único dentro de la
 * tabla, así que nunca colisiona, aunque en ese caso no sobreviva al reordenamiento.
 *
 * Vive en su propio módulo —y no como función local de la página— para que se
 * pueda ejercitar sin montar la pantalla entera.
 */
export function rankingRowKey(entry: RankingEntry): string {
  return entry.teamId ?? entry.participantId ?? `pos-${entry.position}`;
}

// ===========================================
// Lados de un partido: quién va a la izquierda y quién a la derecha
// ===========================================
import type { Result } from '@/types';

export interface LadosDelPartido {
  /** El que se pinta a la izquierda. */
  izquierda: Result | undefined;
  /** El que se pinta a la derecha. */
  derecha: Result | undefined;
  /**
   * `true` sólo cuando el dato de localía existe de verdad.
   *
   * Es lo que decide si la tarjeta puede decir "Equipo Local" o tiene que usar
   * etiquetas neutras: afirmar una localía que el sistema no conoce es peor que
   * no decir nada.
   */
  hayLocalia: boolean;
}

/**
 * Ordena los resultados de un partido en dos lados estables.
 *
 * Hasta R23 la tarjeta tomaba `results[0]` como local y `results[1]` como
 * visitante. El modelo `Result` **no tenía ningún campo de localía** y la
 * consulta del fixture no llevaba `orderBy`, así que el orden lo decidía
 * Postgres: el mismo partido podía leerse "San Martín 3 : 1 Belgrano" en un
 * refetch y "Belgrano 1 : 3 San Martín" en el siguiente.
 *
 * Es el mismo modo de falla que `matchScore.ts` cerró una capa más abajo —ahí
 * era el orden de las claves de un JSON, acá el de las filas de una relación—.
 *
 * Con `isHome` cargado el local va siempre a la izquierda. Sin el dato se
 * conserva el orden que llegó, que ahora el backend hace determinista con su
 * `orderBy`, y se avisa que no hay localía para que la UI no la invente.
 */
export function ordenarLados(resultados: Result[] | undefined): LadosDelPartido {
  const filas = resultados ?? [];

  const local = filas.find((r) => r.isHome === true);
  const visitante = filas.find((r) => r.isHome === false);

  // Sólo se considera que hay localía si están las dos puntas. Un partido con
  // el dato a medias no alcanza para rotular los lados.
  if (local && visitante) {
    return { izquierda: local, derecha: visitante, hayLocalia: true };
  }

  return { izquierda: filas[0], derecha: filas[1], hayLocalia: false };
}

/**
 * Pase directo (bye) de la eliminación directa: el backend lo guarda como un
 * partido FINALIZADO con un único resultado, el del competidor que avanza.
 */
export function esPaseDirecto(resultados: Result[] | undefined): boolean {
  return (resultados?.length ?? 0) === 1;
}

/** Rótulo de un lado sin nombre: "Equipo Local" sólo si la localía es real. */
export function rotuloPorDefecto(indice: number, hayLocalia: boolean): string {
  if (hayLocalia) return indice === 0 ? 'Equipo Local' : 'Equipo Visitante';
  return `Competidor ${String.fromCharCode(65 + indice)}`;
}

/**
 * Nombre visible de un competidor: el equipo, o "Apellido, Nombre" del
 * participante en las disciplinas individuales.
 */
export function nombreDelLado(resultado: Result | undefined, porDefecto: string): string {
  if (resultado?.team?.name) return resultado.team.name;
  const p = resultado?.participant;
  if (p?.lastName) return p.firstName ? `${p.lastName}, ${p.firstName}` : p.lastName;
  return porDefecto;
}

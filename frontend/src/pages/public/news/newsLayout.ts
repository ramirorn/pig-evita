// ===========================================
// Reparto de las noticias en el mosaico
// ===========================================
import type { News } from '@/types';

/**
 * Vive aparte de `NewsPage.tsx` por la misma razón que `newsSource.ts`: un
 * módulo que exporta componentes **y** funciones sueltas rompe el fast refresh
 * de Vite y el lint del proyecto lo marca. Además así la función se puede
 * ejercitar sin montar la página.
 */

interface Reparto {
  /** La pieza principal, con la foto de fondo. */
  grande?: News;
  /** Las que la acompañan arriba, del mismo formato. */
  medias: News[];
  /** Lista compacta de texto, sin imagen. */
  enLista: News[];
  /** Tarjetas clásicas, con foto arriba y texto abajo. */
  enGrilla: News[];
}

/**
 * Decide qué formato le corresponde a cada noticia según cuántas haya.
 *
 * Los cortes no son arbitrarios:
 *
 * - **1 o 2 noticias**: nada de mosaico. Una grande sola ocupando el ancho, y la
 *   otra debajo. Un mosaico con dos piezas es una grilla con huecos.
 * - **3 a 5**: una grande y hasta dos medias arriba; el resto va a la lista
 *   compacta, que llena poco espacio y no promete más contenido del que hay.
 * - **6**: entran todas entre la grande, las medias y la lista; la grilla no se
 *   pinta, porque una sección "Más artículos" vacía es peor que su ausencia.
 * - **7 o más**: recién ahí aparece la grilla de tarjetas, con lo que sobra.
 *
 * En las páginas siguientes a la primera no hay mosaico: quien llegó ahí ya está
 * recorriendo un listado y espera una grilla pareja, no otra portada.
 */
export function repartir(noticias: News[], esPortada: boolean): Reparto {
  if (!esPortada) {
    return { medias: [], enLista: [], enGrilla: noticias };
  }

  const [primera, ...resto] = noticias;

  if (noticias.length <= 2) {
    return { grande: primera, medias: [], enLista: resto, enGrilla: [] };
  }

  if (noticias.length <= 5) {
    return {
      grande: primera,
      medias: resto.slice(0, 2),
      enLista: resto.slice(2),
      enGrilla: [],
    };
  }

  return {
    grande: primera,
    medias: resto.slice(0, 2),
    enLista: resto.slice(2, 5),
    enGrilla: resto.slice(5),
  };
}

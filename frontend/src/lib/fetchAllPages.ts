// ===========================================
// fetchAllPages — recorre un listado paginado hasta el final
// ===========================================
import type { PaginatedResponse } from '@/types';

/**
 * Tope duro de `limit` en el backend (`pagination.dto.ts`, `@Max(100)`).
 *
 * Pedir `limit: 100` **no** significa "traeme todo": significa "traeme como
 * mucho 100". Un listado más largo se corta ahí sin error, sin toast y sin
 * ningún indicio en la respuesta salvo el `meta.totalPages` que nadie miraba.
 */
const LIMITE_MAXIMO_BACKEND = 100;

/**
 * Freno de mano. Un catálogo de más de 2.000 filas no se resuelve trayéndolo
 * entero a un `<select>`: si se llega acá, el problema es de diseño de pantalla
 * y hace falta un buscador con paginación real.
 */
const MAX_PAGINAS = 20;

/**
 * Trae **todas** las páginas de un listado y devuelve las filas concatenadas.
 *
 * Pensado para catálogos acotados que una pantalla necesita completos
 * (disciplinas, categorías de una disciplina), no para listados de datos
 * transaccionales, que tienen que paginar de verdad.
 *
 * @param traerPagina Función que pide una página concreta al backend.
 */
export async function fetchAllPages<T>(
  traerPagina: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const acumulado: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const respuesta = await traerPagina(page, LIMITE_MAXIMO_BACKEND);
    acumulado.push(...respuesta.data);
    totalPages = respuesta.meta.totalPages;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGINAS);

  return acumulado;
}

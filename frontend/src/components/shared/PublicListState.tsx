// ===========================================
// PublicListState — las tres ramas de un listado público, en un solo lugar
// ===========================================
import type { ReactNode } from 'react';

interface PublicListStateProps {
  isLoading: boolean;
  /** Ya cargó y no hay nada que mostrar. */
  isEmpty: boolean;
  /** Qué pintar mientras carga: normalmente un `<CardGridSkeleton />`. */
  skeleton: ReactNode;
  /** Qué pintar si no hay datos: normalmente un `<EmptyState />`. */
  empty: ReactNode;
  children: ReactNode;
}

/**
 * Las cuatro páginas públicas de listado repetían el mismo ternario de tres
 * ramas —cargando → hay datos → vacío— con cuatro markups distintos, y los
 * cuatro spinners eran el mismo `Loader2` centrado con un `py-20`/`py-24`
 * copiado a mano.
 *
 * El problema no era la duplicación en sí sino que eran **cuatro
 * oportunidades de olvidarse de lo mismo**: ninguna de las cuatro anunciaba la
 * carga. Un lector de pantalla se quedaba en silencio desde que la página se
 * montaba hasta que aparecían las tarjetas, sin ninguna pista de que hubiera
 * algo en camino. Acá el `role="status"` + `aria-busy` + el texto `sr-only` se
 * escriben una vez y las cuatro páginas los heredan.
 *
 * Va antes que cualquier rediseño de página por el mismo motivo por el que S01
 * fue primero: si se hiciera después, cada arreglo de accesibilidad habría que
 * aplicarlo cuatro veces y la cuarta se olvida.
 */
export function PublicListState({
  isLoading,
  isEmpty,
  skeleton,
  empty,
  children,
}: PublicListStateProps) {
  if (isLoading) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando el listado…</span>
        {skeleton}
      </div>
    );
  }

  if (isEmpty) return <>{empty}</>;

  return <>{children}</>;
}

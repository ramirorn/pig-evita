// ===========================================
// Grilla de resultados de /noticias (búsqueda, filtro o "Ver todas")
// ===========================================
import { useEffect, useRef } from 'react';
import { ArrowLeft, Newspaper } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { PublicListState } from '@/components/shared/PublicListState';
import type { News } from '@/types';
import { NewsListSkeleton } from './NewsListSkeleton';
import { GrillaDeNotas } from './NewsSections';

interface ResultadosProps {
  /** Llevar el foco al encabezado al montarse (se llegó por "Ver todas"). */
  enfocar: boolean;
  onEnfocado: () => void;
  noticias: News[];
  meta?: { page: number; totalPages: number; total: number; limit: number };
  isLoading: boolean;
  hayFiltro: boolean;
  onPageChange: (page: number) => void;
  onVolver: () => void;
}

/** Grilla pareja y paginada: búsqueda, filtro de origen o "Ver todas". */
export function Resultados({
  enfocar,
  onEnfocado,
  noticias,
  meta,
  isLoading,
  hayFiltro,
  onPageChange,
  onVolver,
}: ResultadosProps) {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!enfocar) return;
    tituloRef.current?.focus({ preventScroll: true });
    // Arriba de todo: el encabezado de la grilla queda a la vista con el
    // buscador y los filtros, que es desde donde se sigue.
    // 'instant': el html tiene scroll-behavior smooth y la animación se corta
    // cuando la grilla reemplaza al esqueleto.
    window.scrollTo({ top: 0, behavior: 'instant' });
    onEnfocado();
  }, [enfocar, onEnfocado]);

  return (
    <section aria-labelledby="resultados-titulo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="resultados-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="type-h2 scroll-mt-24 relative pt-3 before:absolute before:top-0 before:left-0 before:h-0.5 before:w-10 before:rounded-full before:bg-primary-600 before:content-[''] text-primary-900 focus:outline-none"
        >
          {hayFiltro ? 'Resultados' : 'Todas las noticias'}
          {meta && (
            <span className="ml-2 text-base font-semibold text-primary-600 tabular-nums">({meta.total})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary-600 transition-colors duration-120 hover:text-primary-800 active:text-primary-900 pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a la portada
        </button>
      </div>

      <PublicListState
        isLoading={isLoading}
        isEmpty={noticias.length === 0}
        skeleton={<NewsListSkeleton variante="grilla" />}
        empty={
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title="Sin noticias disponibles"
            description={
              // Cierta: la búsqueda la resolvió el backend sobre el archivo
              // completo, no un `filter()` sobre las filas traídas.
              hayFiltro
                ? 'No se encontraron artículos que coincidan con la búsqueda o el filtro.'
                : 'No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!'
            }
          />
        }
      >
        <GrillaDeNotas noticias={noticias} />
        {meta && meta.totalPages > 1 && (
          <div className="mt-6 rounded-2xl border border-primary-100 bg-surface-elevated">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={onPageChange}
              className="border-t-0"
            />
          </div>
        )}
      </PublicListState>
    </section>
  );
}

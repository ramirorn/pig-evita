// ===========================================
// News Page — Public
// ===========================================
import { Newspaper, Search, X } from 'lucide-react';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { PublicListState } from '@/components/shared/PublicListState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { NewsListSkeleton } from './news/NewsListSkeleton';
import { NewsTickerCard } from './news/NewsTickerCard';
import { NewsHeroCarousel } from './news/NewsHeroCarousel';
import { NewsSidebarList } from './news/NewsSidebarList';
import { UpcomingEventsPanel } from './news/UpcomingEventsPanel';
import { NOTAS_EN_PORTADA } from './news/newsLayout';
import { NewsOriginFilter } from './news/NewsOriginFilter';
import { GrillaDeNotas, Mosaico, TituloDeSeccion } from './news/NewsSections';
import { Resultados } from './news/NewsResults';
import { useNewsPageData } from './news/useNewsPageData';

/**
 * Columnas de la tira superior en escritorio según cuántas notas lleva. Clases
 * completas: Tailwind no ve las armadas por interpolación.
 */
const COLUMNAS_DE_LA_TIRA: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

/**
 * `/noticias` tiene dos vistas y una sola regla para elegir:
 *
 * - **Portada editorial** (vista "Todas", sin búsqueda): tira de notas
 *   compactas, carrusel con las 4 más recientes junto a "Próximos eventos",
 *   mosaico "No te pierdas" con la lista "Más recientes", y debajo el archivo
 *   con lo que no entró. Ninguna nota se repite entre secciones.
 * - **Grilla de resultados** (búsqueda, filtro de origen o "Ver todas"): una
 *   grilla pareja y paginada, en orden de publicación.
 *
 * Con un filtro activo no se reparte el resultado en el mosaico: un carrusel
 * "destacado" de resultados de búsqueda destacaría notas por coincidir, no por
 * ser importantes, y quien busca quiere recorrer la lista entera.
 */
export function NewsPage() {
  // Datos y estado en `useNewsPageData`; acá queda el dibujo.
  const {
    search,
    setSearch,
    origen,
    cambiarOrigen,
    hayFiltro,
    enListado,
    setPage,
    paginaArchivo,
    setPaginaArchivo,
    enfocarResultados,
    terminarEnfoque,
    portada,
    archivo,
    resultados,
    calendario,
    totalPublicadas,
    paginasDeArchivo,
    reparto,
    eventos,
    sedePorId,
    abrirTodas,
    volverAPortada,
  } = useNewsPageData();

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <PublicPageHeader
          title="Noticias"
          description="Actualidad de los Juegos Evita Formoseños y del portal oficial de la provincia."
          icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
          actions={
            <div className="relative w-full md:w-80">
              <Search
                className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-primary-500"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar noticias..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar noticias"
                className="h-10 pointer-coarse:h-11 rounded-full border-primary-200 bg-surface-elevated pr-10 pl-11 text-sm shadow-sm focus-visible:ring-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar la búsqueda de noticias"
                  className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-primary-500 transition-colors duration-120 hover:text-primary-800 active:bg-primary-100 pointer-coarse:h-11 pointer-coarse:w-11 focus-visible:outline-2 focus-visible:outline-primary-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          }
        />

        <NewsOriginFilter
          valor={origen}
          onChange={cambiarOrigen}
        />

        {enListado ? (
          <Resultados
            enfocar={enfocarResultados}
            onEnfocado={terminarEnfoque}
            noticias={resultados.data?.data ?? []}
            meta={resultados.data?.meta}
            isLoading={resultados.isLoading}
            hayFiltro={hayFiltro}
            onPageChange={setPage}
            onVolver={volverAPortada}
          />
        ) : (
          <PublicListState
            isLoading={portada.isLoading}
            isEmpty={reparto.carrusel.length === 0}
            skeleton={<NewsListSkeleton />}
            empty={
              <EmptyState
                icon={<Newspaper className="h-10 w-10" />}
                title="Sin noticias disponibles"
                description="No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!"
              />
            }
          >
            <div className="space-y-8 md:space-y-10">
              {/* 1. Tira de notas compactas. En celular, fila deslizable. */}
              {reparto.tira.length > 0 && (
                <section aria-labelledby="tira-titulo">
                  <h2 id="tira-titulo" className="sr-only">
                    Últimas notas
                  </h2>
                  <ul
                    className={cn(
                      'relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0',
                      COLUMNAS_DE_LA_TIRA[reparto.tira.length] ?? 'lg:grid-cols-4',
                    )}
                  >
                    {reparto.tira.map((n) => (
                      <li key={n.id} className="w-72 shrink-0 snap-start lg:w-auto">
                        <NewsTickerCard news={n} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 2. Carrusel destacado + próximos eventos del calendario. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
                <div className="lg:col-span-8">
                  <NewsHeroCarousel noticias={reparto.carrusel} />
                </div>
                <div className="lg:col-span-4">
                  <UpcomingEventsPanel
                    eventos={eventos}
                    sedePorId={sedePorId}
                    estado={
                      calendario.isLoading
                        ? 'cargando'
                        : calendario.isError
                          ? 'error'
                          : 'listo'
                    }
                  />
                </div>
              </div>

              {/* 3. "No te pierdas" + "Más recientes". */}
              {(reparto.mosaico.length > 0 || reparto.lista.length > 0) && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {reparto.mosaico.length > 0 && (
                    <section
                      aria-labelledby="no-te-pierdas-titulo"
                      className={reparto.lista.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}
                    >
                      <TituloDeSeccion id="no-te-pierdas-titulo">No te pierdas</TituloDeSeccion>
                      <Mosaico noticias={reparto.mosaico} />
                    </section>
                  )}

                  {reparto.lista.length > 0 && (
                    <section
                      aria-labelledby="mas-recientes-titulo"
                      className={
                        reparto.mosaico.length > 0
                          ? 'rounded-2xl border border-primary-100 bg-surface-elevated p-4 shadow-sm lg:col-span-4'
                          : 'rounded-2xl border border-primary-100 bg-surface-elevated p-4 shadow-sm lg:col-span-12'
                      }
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        {/* "Más recientes" y no "lo más leído": la plataforma no
                            cuenta lecturas. */}
                        <h2
                          id="mas-recientes-titulo"
                          className="type-h2 text-primary-900"
                        >
                          Más recientes
                        </h2>
                        <button
                          type="button"
                          onClick={abrirTodas}
                          className="rounded-md text-sm font-semibold text-primary-600 underline-offset-4 transition-colors duration-120 hover:text-primary-800 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                        >
                          Ver todas<span className="sr-only"> las noticias</span>
                        </button>
                      </div>
                      <NewsSidebarList news={reparto.lista} />
                    </section>
                  )}
                </div>
              )}

              {/* 4. Archivo: lo que no entró en la portada, paginado. */}
              {(reparto.resto.length > 0 || paginasDeArchivo > 0) && (
                <section aria-labelledby="mas-noticias-titulo">
                  <TituloDeSeccion id="mas-noticias-titulo">Más noticias</TituloDeSeccion>
                  <PublicListState
                    isLoading={archivo.isLoading}
                    isEmpty={false}
                    skeleton={<NewsListSkeleton variante="grilla" />}
                    empty={null}
                  >
                    <GrillaDeNotas
                      noticias={[...reparto.resto, ...(archivo.data?.data ?? [])]}
                    />
                  </PublicListState>
                  {paginasDeArchivo > 1 && (
                    <div className="mt-6 rounded-2xl border border-primary-100 bg-surface-elevated">
                      <Pagination
                        page={paginaArchivo}
                        totalPages={paginasDeArchivo}
                        total={Math.max(0, totalPublicadas - NOTAS_EN_PORTADA)}
                        limit={NOTAS_EN_PORTADA}
                        onPageChange={setPaginaArchivo}
                        className="border-t-0"
                      />
                    </div>
                  )}
                </section>
              )}

              {/* Sin archivo, el acceso a todas las notas en lista es "Ver todas". */}
              {paginasDeArchivo === 0 && reparto.lista.length === 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={abrirTodas}
                    className="rounded-full border border-primary-200 bg-surface-elevated px-5 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-colors duration-120 hover:bg-primary-50 active:bg-primary-100 pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    Ver todas las noticias en lista
                  </button>
                </div>
              )}
            </div>
          </PublicListState>
        )}
      </div>
    </div>
  );
}

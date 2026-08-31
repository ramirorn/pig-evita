// ===========================================
// News Page — Public
// ===========================================
import { useEffect, useState } from 'react';
import { Newspaper, Search, X, Star, LayoutGrid, Clock } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { useDebounce } from '@/hooks/useDebounce';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { Input } from '@/components/ui/input';
import { NewsListSkeleton } from './news/NewsListSkeleton';
import { FeaturedNewsCard } from './news/FeaturedNewsCard';
import { NewsCard } from './news/NewsCard';
import { NewsSidebarList } from './news/NewsSidebarList';
import {
  NewsOriginFilter,
  type OrigenDeNoticia,
} from './news/NewsOriginFilter';

/**
 * Una destacada, tres en la columna lateral y ocho en la grilla de abajo.
 *
 * El número sale del layout: la portada muestra 1 + 3 arriba y dos filas de
 * cuatro debajo. Cambiar la grilla obliga a revisar esto.
 */
const NOTICIAS_POR_PAGINA = 12;

/** Cuántas acompañan a la destacada en la columna lateral. */
const EN_LA_COLUMNA = 3;

export function NewsPage() {
  const [search, setSearch] = useState('');
  const [origen, setOrigen] = useState<OrigenDeNoticia>(undefined);
  const [page, setPage] = useState(1);
  const busqueda = useDebounce(search.trim());

  // La búsqueda y el filtro los resuelve el backend (`/news?search=&isExternal=`),
  // no un `filter()` sobre lo que trajimos. Antes se pedía `limit: 50` y se
  // filtraba en memoria: la noticia 51 no se encontraba buscándola y el
  // `EmptyState` afirmaba que no había artículos que coincidieran, cuando lo
  // cierto era que no había coincidencias entre las 50 traídas (R29).
  const { data: newsData, isLoading } = useNewsList({
    isPublished: true,
    page,
    limit: NOTICIAS_POR_PAGINA,
    search: busqueda || undefined,
    isExternal: origen,
  });

  // Cambiar la búsqueda o el filtro reinicia la paginación: quedarse en la
  // página 4 con un resultado nuevo de una sola página deja la pantalla vacía
  // sin motivo.
  useEffect(() => {
    setPage(1);
  }, [busqueda, origen]);

  const pageNews = newsData?.data ?? [];
  const meta = newsData?.meta;

  // La portada —destacada + columna— es de la primera página. En las siguientes
  // va todo a la grilla, que es donde el usuario ya viene leyendo en lista.
  const esPortada = page === 1;
  const featured = esPortada ? pageNews[0] : undefined;
  const enLaColumna = esPortada ? pageNews.slice(1, 1 + EN_LA_COLUMNA) : [];
  const enLaGrilla = esPortada ? pageNews.slice(1 + EN_LA_COLUMNA) : pageNews;

  const hayFiltro = Boolean(busqueda) || origen !== undefined;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-8">
        <PublicPageHeader
          title="Noticias y Novedades"
          description="Actualidad institucional y cronogramas de juego de los Juegos Evita Formoseños."
          icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
          actions={
            <div className="relative w-full md:w-80">
              <Search
                className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar noticias..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar noticias"
                className="h-11 rounded-full border-primary-200 bg-white/80 pr-10 pl-11 text-sm shadow-[0_10px_40px_-10px_rgba(0,45,108,0.08)] backdrop-blur-xl focus-visible:ring-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar la búsqueda de noticias"
                  className="absolute top-1/2 right-4 -translate-y-1/2 text-primary-400 hover:text-primary-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          }
        />

        <NewsOriginFilter valor={origen} onChange={setOrigen} />

        {isLoading ? (
          <NewsListSkeleton />
        ) : pageNews.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title="Sin noticias disponibles"
            description={
              // La frase es cierta: la búsqueda y el filtro los resolvió el
              // backend sobre el archivo completo, no un `filter()` sobre 50
              // filas traídas de antemano.
              hayFiltro
                ? 'No se encontraron artículos que coincidan con la búsqueda o el filtro.'
                : 'No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!'
            }
          />
        ) : (
          <div className="space-y-12">
            {/* Portada: destacada + columna lateral */}
            {esPortada && featured && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                <div className="md:col-span-8">
                  <div className="mb-4 flex items-center gap-2 text-primary-800">
                    <Star className="h-5 w-5 fill-accent-500 text-accent-500" />
                    <h2 className="text-sm font-bold tracking-wider uppercase">
                      Destacado
                    </h2>
                  </div>
                  <FeaturedNewsCard news={featured} />
                </div>

                {enLaColumna.length > 0 && (
                  <div className="md:col-span-4">
                    <div className="mb-4 flex items-center gap-2 text-primary-800">
                      <Clock className="h-5 w-5" />
                      {/* Dice "recientes" y no "lo más leído": no hay contador
                          de visitas que respalde un ranking. */}
                      <h2 className="text-sm font-bold tracking-wider uppercase">
                        Más recientes
                      </h2>
                    </div>
                    <NewsSidebarList news={enLaColumna} />
                  </div>
                )}
              </div>
            )}

            {/* Grilla */}
            {enLaGrilla.length > 0 && (
              <div>
                <div className="mb-6 flex items-center gap-2 text-primary-800">
                  <LayoutGrid className="h-5 w-5" />
                  <h2 className="font-display text-xl font-bold">
                    Más artículos
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {enLaGrilla.map((news, idx) => (
                    <NewsCard key={news.id} news={news} index={idx} />
                  ))}
                </div>
              </div>
            )}

            {/* Paginación real: el archivo de noticias ya no termina donde
                terminaba el `limit`. */}
            {meta && meta.totalPages > 1 && (
              <div className="rounded-2xl border border-primary-100 bg-white">
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  limit={meta.limit}
                  onPageChange={setPage}
                  className="border-t-0"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

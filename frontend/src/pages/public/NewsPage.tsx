// ===========================================
// News Page — Public
// ===========================================
import { useEffect, useState } from "react";
import { Newspaper, Search, X, Tag } from "lucide-react";
import { useNewsList } from "@/hooks/useNews";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";
import { NewsListSkeleton } from "./news/NewsListSkeleton";
import { FeaturedNewsCard } from "./news/FeaturedNewsCard";
import { NewsCard } from "./news/NewsCard";

/** Una destacada arriba y dos filas de tres en la grilla. */
const NOTICIAS_POR_PAGINA = 7;

export function NewsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const busqueda = useDebounce(search.trim());

  // La búsqueda la resuelve el backend (`/news?search=`), no un `filter()` sobre
  // lo que trajimos. Antes se pedía `limit: 50` y se filtraba en memoria: la
  // noticia 51 no se encontraba buscándola y el `EmptyState` afirmaba que no
  // había artículos que coincidieran, cuando lo cierto era que no había
  // coincidencias entre las 50 que habíamos traído (R29).
  const { data: newsData, isLoading } = useNewsList({
    isPublished: true,
    page,
    limit: NOTICIAS_POR_PAGINA,
    search: busqueda || undefined,
  });

  // Escribir en el buscador reinicia la paginación: quedarse en la página 4 con
  // un resultado nuevo de una sola página deja la pantalla vacía sin motivo.
  useEffect(() => {
    setPage(1);
  }, [busqueda]);

  const pageNews = newsData?.data ?? [];
  const meta = newsData?.meta;

  // La destacada es la primera de la página; en las siguientes va todo a la
  // grilla, que es donde el usuario ya está leyendo en formato lista.
  const featured = page === 1 ? pageNews[0] : undefined;
  const rest = page === 1 ? pageNews.slice(1) : pageNews;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <PageHero
        title="Noticias y Novedades"
        description="Mantenete informado sobre todo lo que pasa en las diferentes etapas de los Juegos Evita Formosa."
        icon={<Newspaper className="w-8 h-8 text-white" />}
        variant="celeste"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Barra superior de Búsqueda y Estadísticas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-primary-900">
              Últimas Publicaciones
            </h2>
            <p className="text-xs text-primary-600">
              Actualidad institucional y cronogramas de juego
            </p>
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input
              placeholder="Buscar noticias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-sm rounded-xl border-primary-200 bg-white focus-visible:ring-primary-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Limpiar la búsqueda de noticias"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          /* Skeletons */
          <NewsListSkeleton />
        ) : pageNews.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Sin noticias disponibles"
            description={
              // Ahora esta frase es cierta: la búsqueda la resolvió el backend
              // sobre el archivo completo, no un `filter()` sobre 50 filas.
              busqueda
                ? "No se encontraron artículos que coincidan con tu búsqueda."
                : "No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!"
            }
          />
        ) : (
          <div className="space-y-10">
            {/* NOTICIA DESTACADA (Hero Card) */}
            {featured && <FeaturedNewsCard news={featured} />}

            {/* GRILLA DE NOTICIAS SECUNDARIAS */}
            {rest.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-primary-900 mb-6 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary-500" />
                  Más Artículos y Comunicados
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((news, idx) => (
                    <NewsCard key={news.id} news={news} index={idx} />
                  ))}
                </div>
              </div>
            )}

            {/* Paginación real: el archivo de noticias ya no termina donde
                terminaba el `limit`. */}
            {meta && meta.totalPages > 1 && (
              <div className="bg-white rounded-2xl border border-primary-100">
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

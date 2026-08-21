// ===========================================
// News Page — Public
// ===========================================
import { useState, useMemo } from "react";
import { Newspaper, Search, X, Tag } from "lucide-react";
import { useNewsList } from "@/hooks/useNews";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { NewsListSkeleton } from "./news/NewsListSkeleton";
import { FeaturedNewsCard } from "./news/FeaturedNewsCard";
import { NewsCard } from "./news/NewsCard";

export function NewsPage() {
  const [search, setSearch] = useState("");
  const { data: newsData, isLoading } = useNewsList({
    isPublished: true,
    limit: 50,
  });
  const allNews = newsData?.data || [];

  const filteredNews = useMemo(() => {
    if (!search.trim()) return allNews;
    const q = search.toLowerCase();
    return allNews.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.excerpt && n.excerpt.toLowerCase().includes(q)),
    );
  }, [allNews, search]);

  const featured = filteredNews[0];
  const rest = filteredNews.slice(1);

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
        ) : filteredNews.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Sin noticias disponibles"
            description={
              search
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
          </div>
        )}
      </div>
    </div>
  );
}

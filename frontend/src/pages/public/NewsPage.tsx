// ===========================================
// News Page — Public
// ===========================================
import { useState, useMemo } from "react";
import {
  Newspaper,
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  Search,
  X,
  Tag,
} from "lucide-react";
import { useNewsList } from "@/hooks/useNews";
import { Link } from "react-router";
import { PageHero } from "@/components/shared/PageHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

// Fallback visual elegante cuando no hay imagen o falla la carga
function NewsImagePlaceholder({
  title,
  isLarge = false,
}: {
  title: string;
  isLarge?: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-celeste-900 p-6 text-center relative overflow-hidden select-none">
      {/* Patrón decorativo de fondo */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-celeste-400/10 blur-2xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-accent-400/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center mb-3 shadow-inner">
          <Newspaper className="w-7 h-7 text-celeste-300" />
        </div>
        <span className="text-white/80 font-bold uppercase tracking-wider text-[11px]">
          Juegos Evita Formosa
        </span>
        {isLarge && (
          <span className="text-white/60 text-xs mt-1 max-w-xs line-clamp-1 font-medium">
            {title}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente de Imagen con manejo seguro de errores
function SafeNewsImage({
  src,
  alt,
  isLarge = false,
}: {
  src?: string | null;
  alt: string;
  isLarge?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return <NewsImagePlaceholder title={alt} isLarge={isLarge} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}

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
          <div className="space-y-8 animate-fade-in">
            <div className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm">
              <div className="grid md:grid-cols-2 h-80">
                <div className="bg-primary-100 animate-shimmer" />
                <div className="p-8 space-y-4">
                  <div className="h-4 w-24 bg-primary-100 rounded animate-shimmer" />
                  <div className="h-8 w-4/5 bg-primary-100 rounded animate-shimmer" />
                  <div className="h-4 w-full bg-primary-100 rounded animate-shimmer" />
                  <div className="h-4 w-2/3 bg-primary-100 rounded animate-shimmer" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm"
                >
                  <div className="h-48 bg-primary-100 animate-shimmer" />
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-20 bg-primary-100 rounded animate-shimmer" />
                    <div className="h-5 w-full bg-primary-100 rounded animate-shimmer" />
                    <div className="h-4 w-3/4 bg-primary-100 rounded animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            {featured && (
              <Link
                to={`/noticias/${featured.slug}`}
                className="block group animate-fade-in"
              >
                <div className="bg-white rounded-3xl border border-primary-100 shadow-sm hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                  <div className="grid md:grid-cols-12 items-stretch">
                    {/* Contenedor de Imagen (5 columnas en desktop) */}
                    <div className="md:col-span-6 lg:col-span-7 h-72 md:h-96 relative overflow-hidden bg-primary-900">
                      <SafeNewsImage
                        src={featured.imageKey}
                        alt={featured.title}
                        isLarge
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary-950/40 via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Contenedor de Texto (7 columnas en desktop) */}
                    <div className="md:col-span-6 lg:col-span-5 p-6 md:p-8 lg:p-10 flex flex-col justify-between bg-white">
                      <div>
                        {/* Metadatos y Badges */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-accent-50 text-accent-700 border border-accent-200 shadow-xs">
                            <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                            Destacada
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(featured.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 ml-auto hidden sm:inline-flex">
                            <Clock className="w-3.5 h-3.5" />3 min de lectura
                          </span>
                        </div>

                        {/* Título de la Noticia */}
                        <h3 className="text-2xl md:text-3xl font-extrabold text-primary-900 group-hover:text-primary-600 transition-colors leading-tight mb-3.5">
                          {featured.title}
                        </h3>

                        {/* Resumen / Bajada */}
                        <p className="text-primary-600 text-sm md:text-base leading-relaxed line-clamp-3 mb-6">
                          {featured.excerpt ||
                            featured.content.substring(0, 180) + "..."}
                        </p>
                      </div>

                      {/* Botón de llamada a la acción */}
                      <div className="pt-4 border-t border-primary-50 flex items-center justify-between">
                        <span className="text-primary-700 font-bold text-sm inline-flex items-center gap-2 group-hover:text-primary-900 transition-colors">
                          Leer artículo completo
                          <div className="w-7 h-7 rounded-full bg-primary-50 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* GRILLA DE NOTICIAS SECUNDARIAS */}
            {rest.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-primary-900 mb-6 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary-500" />
                  Más Artículos y Comunicados
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((news, idx) => (
                    <Link
                      key={news.id}
                      to={`/noticias/${news.slug}`}
                      className="animate-fade-in group flex flex-col"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className="bg-white rounded-2xl border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
                        {/* Cabecera de Imagen (16:9) */}
                        <div className="aspect-video relative overflow-hidden bg-primary-900">
                          <SafeNewsImage src={news.imageKey} alt={news.title} />
                          <div className="absolute top-3 left-3 z-10">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-primary-800 shadow-xs border border-white/40">
                              Actualidad
                            </span>
                          </div>
                        </div>

                        {/* Cuerpo de la Tarjeta */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-primary-400 mb-2">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formatDate(news.createdAt)}</span>
                            </div>

                            <h4 className="font-bold text-primary-900 text-lg mb-2.5 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug">
                              {news.title}
                            </h4>

                            <p className="text-primary-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-4">
                              {news.excerpt ||
                                news.content.substring(0, 120) + "..."}
                            </p>
                          </div>

                          {/* Footer de Tarjeta */}
                          <div className="pt-3 border-t border-primary-50 flex items-center justify-between text-xs font-bold text-primary-600 group-hover:text-primary-900 transition-colors">
                            <span>Leer más</span>
                            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </Link>
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

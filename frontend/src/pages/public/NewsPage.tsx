// ===========================================
// News Page — Public
// ===========================================
import { Newspaper, ArrowRight } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { Link } from 'react-router';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';

export function NewsPage() {
  const { data: newsData, isLoading } = useNewsList({ isPublished: true });
  const allNews = newsData?.data || [];
  const featured = allNews[0];
  const rest = allNews.slice(1);

  return (
    <div>
      <PageHero
        title="Noticias y Novedades"
        description="Mantenete informado sobre todo lo que pasa en los Juegos Evita Formosa."
        icon={<Newspaper className="w-8 h-8 text-white" />}
        variant="celeste"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          /* Skeleton loading */
          <div className="space-y-6 animate-fade-in">
            {/* Featured skeleton */}
            <div className="card overflow-hidden">
              <div className="grid md:grid-cols-2">
                <div className="h-64 md:h-auto bg-primary-100 animate-shimmer" />
                <div className="p-8 space-y-4">
                  <div className="h-3 w-20 bg-primary-100 rounded animate-shimmer" />
                  <div className="h-6 w-3/4 bg-primary-100 rounded animate-shimmer" />
                  <div className="h-4 w-full bg-primary-100 rounded animate-shimmer" />
                  <div className="h-4 w-2/3 bg-primary-100 rounded animate-shimmer" />
                </div>
              </div>
            </div>
            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card overflow-hidden">
                  <div className="h-48 bg-primary-100 animate-shimmer" />
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-16 bg-primary-100 rounded animate-shimmer" />
                    <div className="h-5 w-3/4 bg-primary-100 rounded animate-shimmer" />
                    <div className="h-4 w-full bg-primary-100 rounded animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : allNews.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="w-10 h-10" />}
            title="Sin noticias"
            description="No hay noticias publicadas en este momento. ¡Volvé pronto!"
          />
        ) : (
          <div className="space-y-10">
            {/* Featured article */}
            {featured && (
              <Link to={`/noticias/${featured.slug}`} className="block animate-fade-in">
                <div className="card overflow-hidden group hover:shadow-xl transition-all">
                  <div className="grid md:grid-cols-2">
                    <div className="h-64 md:h-80 bg-primary-100 overflow-hidden">
                      {featured.imageKey ? (
                        <img
                          src={featured.imageKey}
                          alt={featured.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-celeste-100">
                          <Newspaper className="w-16 h-16 text-primary-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent-600 bg-accent-50 px-2.5 py-0.5 rounded-full">
                          Destacada
                        </span>
                        <span className="text-xs text-primary-400">
                          {formatDate(featured.createdAt)}
                        </span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-primary-900 mb-3 group-hover:text-primary-600 transition-colors leading-tight">
                        {featured.title}
                      </h2>
                      <p className="text-primary-600 leading-relaxed mb-4 line-clamp-3">
                        {featured.excerpt || featured.content.substring(0, 200) + '...'}
                      </p>
                      <span className="text-primary-600 font-semibold text-sm flex items-center gap-1 group-hover:text-primary-800 transition-colors">
                        Leer artículo completo <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Remaining news grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((news, idx) => (
                  <Link
                    key={news.id}
                    to={`/noticias/${news.slug}`}
                    className="animate-fade-in"
                    style={{ animationDelay: `${idx * 0.07}s` }}
                  >
                    <div className="card h-full flex flex-col overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group">
                      <div className="h-48 bg-primary-100 flex items-center justify-center overflow-hidden">
                        {news.imageKey ? (
                          <img src={news.imageKey} alt={news.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <Newspaper className="w-12 h-12 text-primary-300" />
                        )}
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wider text-primary-500">
                            Actualidad
                          </span>
                          <span className="text-xs text-primary-400">
                            {formatDate(news.createdAt)}
                          </span>
                        </div>
                        <h3 className="font-bold text-primary-900 text-xl mb-3 line-clamp-2 group-hover:text-primary-600 transition-colors">
                          {news.title}
                        </h3>
                        <p className="text-primary-600 text-sm mb-4 line-clamp-3 flex-1">
                          {news.excerpt || news.content.substring(0, 120) + '...'}
                        </p>
                        <div className="mt-auto">
                          <span className="text-primary-600 font-medium text-sm flex items-center group-hover:text-primary-800">
                            Leer más <ArrowRight className="w-4 h-4 ml-1" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

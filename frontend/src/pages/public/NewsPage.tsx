import { Newspaper, Loader2, ArrowRight } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { Link } from 'react-router';

export function NewsPage() {
  const { data: newsData, isLoading } = useNewsList({ isPublished: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
          <Newspaper className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800 mb-4">Noticias y Novedades</h1>
        <p className="text-primary-600 max-w-2xl mx-auto text-lg">
          Mantenete informado sobre todo lo que pasa en los Juegos Evita Formosa.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {newsData?.data.map((news) => (
            <Link key={news.id} to={`/noticias/${news.slug}`}>
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
                      {new Date(news.createdAt).toLocaleDateString()}
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

          {newsData?.data.length === 0 && (
            <div className="col-span-full py-12 text-center text-primary-500 bg-white rounded-2xl border border-primary-100">
              No hay noticias publicadas en este momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

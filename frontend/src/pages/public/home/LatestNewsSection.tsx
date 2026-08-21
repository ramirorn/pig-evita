// ===========================================
// LatestNewsSection — últimas 3 noticias en la landing
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, Newspaper } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { useNewsList } from '@/hooks/useNews';
import { formatDate, safeImageSrc } from '@/lib/utils';

/**
 * La sección se trae sus propios datos porque es la única consumidora de
 * `useNewsList` en la landing: así la página no arrastra estado de servidor
 * que no usa. Si no hay noticias publicadas la sección no se renderiza.
 */
export function LatestNewsSection() {
  const { data: newsData } = useNewsList({ isPublished: true, limit: 3 });
  const latestNews = newsData?.data.slice(0, 3) || [];

  if (latestNews.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-primary-800 mb-1">
            Últimas Noticias
          </h2>
          <p className="text-primary-500">Lo más reciente de los Juegos Evita Formosa.</p>
        </div>
        <Link
          to={ROUTES.NEWS}
          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
        >
          Ver todas <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {latestNews.map((news, idx) => {
          // `imageKey` es texto libre del backend: sin schema válido se cae
          // al placeholder en vez de meter la URL cruda en el `<img>`.
          const imageSrc = safeImageSrc(news.imageKey);

          return (
          <Link
            key={news.id}
            to={`/noticias/${news.slug}`}
            className={`card group overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all animate-fade-in stagger-${idx + 1}`}
          >
            <div className="h-44 bg-primary-100 flex items-center justify-center overflow-hidden">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={news.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Newspaper className="w-10 h-10 text-primary-300" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-600">
                  Actualidad
                </span>
                <span className="text-xs text-primary-400">
                  {formatDate(news.createdAt)}
                </span>
              </div>
              <h3 className="font-bold text-primary-900 text-lg mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
                {news.title}
              </h3>
              <p className="text-primary-500 text-sm line-clamp-2">
                {news.excerpt || news.content.substring(0, 100) + '...'}
              </p>
            </div>
          </Link>
          );
        })}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link
          to={ROUTES.NEWS}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-primary-600 bg-primary-50 rounded-lg"
        >
          Ver todas las noticias <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}

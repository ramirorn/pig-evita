// ===========================================
// LatestNewsSection — últimas 3 noticias, montadas sobre el hero
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, Newspaper } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { useNewsList } from '@/hooks/useNews';
import { useRevealOnScroll, type RevealPhase } from '@/hooks/useRevealOnScroll';
import { newsImageSrc } from '@/lib/news/newsImageRules';
import { cn } from '@/lib/utils';
import type { News } from '@/types';
import { BadgeNoticiaExterna, NewsLink } from '@/pages/public/news/NewsLink';
import { fechaDeNoticia } from '@/pages/public/news/newsSource';

const CANTIDAD = 3;

/**
 * Clases por fase de aparición. Sólo `opacity` y `transform`: la tarjeta ocupa
 * su lugar desde el principio y nunca sale del árbol de accesibilidad. La
 * transición se agrega recién en `revelado`, así el paso inicial a `oculto`
 * (antes del primer pintado) no se anima. Al imprimir se ve siempre.
 */
const CLASES_FASE: Record<RevealPhase, string> = {
  estatico: '',
  oculto: 'opacity-0 translate-y-6 print:opacity-100 print:translate-y-0',
  revelado: 'opacity-100 translate-y-0 transition-[opacity,transform] duration-700 ease-out',
};

/**
 * Escalonado entre tarjetas. Sólo desde `md`: ahí las tres comparten fila y
 * entran juntas; apiladas en el celular cada una entra cuando le toca, y un
 * retardo extra sólo la demoraría.
 */
const RETARDO = ['', 'md:delay-150', 'md:delay-300'] as const;

/**
 * Primer bloque después del hero: el encabezado queda sobre el degradé azul y
 * las tarjetas se montan sobre el borde inferior con un margen negativo. Por
 * eso el hero reserva aire abajo (`pb`) y las dos secciones van seguidas en
 * `HomePage`.
 *
 * La sección se trae sus propios datos porque es la única consumidora de
 * `useNewsList` en la landing. Mientras carga reserva el lugar con esqueletos
 * (si no, al llegar las noticias empujarían todo lo de abajo); sin noticias
 * publicadas, o si la API falla, no se renderiza.
 */
export function LatestNewsSection() {
  const { data: newsData, isLoading } = useNewsList({ isPublished: true, limit: CANTIDAD });
  const latestNews = newsData?.data.slice(0, CANTIDAD) ?? [];

  if (!isLoading && latestNews.length === 0) return null;

  return (
    <section
      aria-labelledby="ultimas-noticias"
      className="relative z-20 mx-auto -mt-44 max-w-7xl px-4 pb-8 sm:px-6 md:-mt-52 lg:px-8"
    >
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h2
            id="ultimas-noticias"
            className="font-display mb-1 text-2xl font-bold text-white md:text-3xl"
          >
            Últimas Noticias
          </h2>
          <p className="text-celeste-100">Lo más reciente de los Juegos Evita Formosa.</p>
        </div>
        <Link
          to={ROUTES.NEWS}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-celeste-200/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-celeste-200/50 hover:bg-white/10 sm:inline-flex"
        >
          Ver todas <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" aria-busy="true">
          {Array.from({ length: CANTIDAD }, (_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="h-44 bg-primary-100 animate-shimmer" />
              <div className="p-5">
                <div className="h-3 w-1/3 rounded bg-primary-100 animate-shimmer" />
                <div className="mt-3 h-5 w-5/6 rounded bg-primary-100 animate-shimmer" />
                <div className="mt-2 h-5 w-2/3 rounded bg-primary-100 animate-shimmer" />
                <div className="mt-4 h-4 w-full rounded bg-primary-100 animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {latestNews.map((news, idx) => (
            <LatestNewsCard key={news.id} news={news} retardo={RETARDO[idx] ?? ''} />
          ))}
        </div>
      )}

      <div className="mt-6 text-center sm:hidden">
        <Link
          to={ROUTES.NEWS}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-5 py-2.5 text-sm font-semibold text-primary-600"
        >
          Ver todas las noticias <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Cada tarjeta observa su propio nodo: en el celular, apiladas, entran de a
 * una a medida que se scrollea. El envoltorio anima la entrada y el enlace
 * conserva su propio `hover:-translate-y-1`, sin pisarse los `transform`.
 */
function LatestNewsCard({ news, retardo }: { news: News; retardo: string }) {
  const { ref, phase } = useRevealOnScroll<HTMLDivElement>();
  // Subida (ruta de la API) o externa (pasa por `safeImageSrc`): lo que no
  // valida cae al placeholder en vez de llegar crudo al `<img>`.
  const imageSrc = newsImageSrc(news.imageUrl);

  return (
    <div ref={ref} className={cn(CLASES_FASE[phase], phase === 'revelado' && retardo)}>
      {/* S19 — las traídas del portal oficial llevan al original, no a un
          detalle propio que no tiene el cuerpo del artículo. */}
      <NewsLink
        news={news}
        className="card group flex h-full flex-col overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,45,108,0.15)] transition-all hover:-translate-y-1 hover:shadow-xl"
      >
        <div className="flex h-44 items-center justify-center overflow-hidden bg-primary-100">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={news.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <Newspaper className="h-10 w-10 text-primary-300" aria-hidden="true" />
          )}
        </div>
        <div className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-accent-600 uppercase">
              Actualidad
              <BadgeNoticiaExterna news={news} />
            </span>
            <span className="text-xs text-primary-400">{fechaDeNoticia(news)}</span>
          </div>
          <h3 className="mb-2 line-clamp-2 text-lg font-bold text-primary-900 transition-colors group-hover:text-primary-600">
            {news.title}
          </h3>
          <p className="line-clamp-2 text-sm text-primary-500">
            {news.excerpt || news.content.substring(0, 100) + '...'}
          </p>
        </div>
      </NewsLink>
    </div>
  );
}

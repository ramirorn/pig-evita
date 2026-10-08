// ===========================================
// NewsTickerCard — tarjeta compacta de la tira superior de /noticias
// ===========================================
import type { News } from '@/types';
import { SafeNewsImage } from './SafeNewsImage';
import { NewsLink } from './NewsLink';
import { antiguedadDeNoticia, etiquetaDeOrigen } from './newsSource';

/**
 * Miniatura a la izquierda, título en dos renglones y, debajo, "origen ·
 * antigüedad". En la referencia esa línea dice el deporte ("Tennis · 1 hour
 * ago"); acá dice el origen, que es el único dato real que distingue notas.
 *
 * La tarjeta entera es el enlace y es un bloque de alto completo: el contorno
 * de foco envuelve la tarjeta y no una caja inline partida.
 */
export function NewsTickerCard({ news }: { news: News }) {
  const antiguedad = antiguedadDeNoticia(news);

  return (
    <NewsLink
      news={news}
      className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <article className="flex h-full items-center gap-3 rounded-xl border border-primary-100 bg-surface-elevated p-2.5 shadow-sm transition-shadow duration-300 group-hover:shadow-md">
        <div className="aspect-[5/4] w-20 shrink-0 overflow-hidden rounded-lg bg-primary-900">
          <SafeNewsImage src={news.imageKey} alt={news.title} compacta />
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm leading-snug font-bold text-primary-900 transition-colors group-hover:text-primary-600">
            {news.title}
          </h3>
          <p className="mt-1 truncate text-xs text-primary-600">
            {etiquetaDeOrigen(news)}
            {antiguedad && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                {antiguedad}
              </>
            )}
          </p>
        </div>
      </article>
    </NewsLink>
  );
}

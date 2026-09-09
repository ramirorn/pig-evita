// ===========================================
// NewsMosaicCard — tarjeta con el título sobre la imagen
// ===========================================
import { ExternalLink } from 'lucide-react';
import type { News } from '@/types';
import { tiempoRelativo } from '@/lib/utils';
import { SafeNewsImage } from './SafeNewsImage';
import { NewsLink } from './NewsLink';
import { esNoticiaExterna, hostDeLaFuente } from './newsSource';

type Tamano = 'grande' | 'media';

interface NewsMosaicCardProps {
  news: News;
  tamano?: Tamano;
  /** Sólo define el retardo escalonado de la animación de entrada. */
  index?: number;
}

/** Alto por tamaño. La grande manda en la fila; las medias la acompañan. */
const ALTO: Record<Tamano, string> = {
  grande: 'h-80 md:h-[26rem]',
  media: 'h-56 md:h-[12.5rem]',
};

/**
 * Tarjeta con la foto de fondo y el texto encima, en degradé.
 *
 * Es el formato de los lectores de noticias: la imagen ocupa todo y el titular
 * se lee sobre ella. Rinde mejor que la tarjeta con foto arriba y texto abajo
 * cuando hay una buena foto, y ordena el mosaico porque todas las piezas son
 * rectángulos de la misma familia.
 *
 * **La atribución de fuente es la parte que más aporta** y sale de datos reales:
 * `sourceName` para las que vienen del portal oficial (S19) y la plataforma para
 * las propias. Junto a la antigüedad relativa arma la línea "Secretaría de
 * Deportes · hace 5 h", que es lo que le da carácter de feed.
 *
 * No lleva contadores de likes ni de comentarios: la plataforma no tiene
 * reacciones ni comentarios, y unos números ahí serían inventados.
 */
export function NewsMosaicCard({
  news,
  tamano = 'media',
  index = 0,
}: NewsMosaicCardProps) {
  const externa = esNoticiaExterna(news);
  const fuente = externa
    ? (news.sourceName ?? hostDeLaFuente(news.sourceUrl) ?? 'Portal oficial')
    : 'Juegos Evita Formoseños';
  const antiguedad = tiempoRelativo(news.createdAt);
  const esGrande = tamano === 'grande';

  return (
    <NewsLink
      news={news}
      className="group block h-full animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <article
        className={`relative isolate w-full overflow-hidden rounded-2xl bg-primary-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${ALTO[tamano]}`}
      >
        <SafeNewsImage src={news.imageKey} alt={news.title} isLarge={esGrande} />

        {/* El degradé no es decorativo: sin él el titular blanco compite con la
            foto y en una imagen clara deja de leerse. Va de opaco abajo a
            transparente arriba, para tapar lo mínimo. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-950 via-primary-950/70 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          {/* Fuente y antigüedad, la línea que arma el aire de feed. */}
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-white/80">
            <span className="inline-flex items-center gap-1">
              {externa && (
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              )}
              {fuente}
            </span>
            {antiguedad && (
              <>
                <span aria-hidden="true">·</span>
                <span>{antiguedad}</span>
              </>
            )}
          </div>

          <h3
            className={
              esGrande
                ? 'font-display line-clamp-3 text-xl leading-tight font-extrabold text-white md:text-2xl'
                : 'line-clamp-3 text-sm leading-snug font-bold text-white md:text-base'
            }
          >
            {news.title}
          </h3>

          {/* La bajada sólo entra en la grande: en las medias el titular ya
              ocupa el alto disponible y agregarla lo empujaría fuera. */}
          {esGrande && (news.excerpt || news.content) && (
            <p className="mt-2 line-clamp-2 hidden text-sm text-white/80 md:block">
              {news.excerpt || news.content}
            </p>
          )}
        </div>
      </article>
    </NewsLink>
  );
}

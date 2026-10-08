// ===========================================
// FeaturedNewsCard — diapositiva del carrusel destacado de /noticias
// ===========================================
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { News } from '@/types';
import { SafeNewsImage } from './SafeNewsImage';
import { NewsLink } from './NewsLink';
import { NewsOriginChip } from './NewsOriginChip';
import {
  antiguedadDeNoticia,
  bajadaDeNoticia,
  esNoticiaExterna,
  fuenteDeNoticia,
} from './newsSource';

interface FeaturedNewsCardProps {
  news: News;
  /** La primera diapositiva carga su foto de inmediato; el resto, perezosa. */
  prioritaria?: boolean;
}

/**
 * Nota destacada: foto a sangre, degradé oscuro, chip de origen arriba a la
 * izquierda y, abajo, la fuente en color, el título grande, la bajada y el
 * botón "Leer nota completa".
 *
 * **El enlace es el botón y no la tarjeta entera.** El carrusel tiene controles
 * propios encima (flechas, puntos, pausa): una diapositiva toda clicable
 * competiría con ellos por el mismo clic y anidaría elementos interactivos.
 *
 * El botón va a donde la nota vive: si es del portal oficial abre el original
 * en otra pestaña (no tenemos el cuerpo, sólo la bajada); si es propia, el
 * detalle. Eso lo resuelve `NewsLink`.
 *
 * Contraste: el texto se apoya sobre `primary-900` opaco abajo y al 70 % a mitad
 * de altura; sobre una foto blanca eso deja el blanco en ≥ 6.5:1.
 */
export function FeaturedNewsCard({ news, prioritaria = false }: FeaturedNewsCardProps) {
  const externa = esNoticiaExterna(news);
  const antiguedad = antiguedadDeNoticia(news);
  const bajada = bajadaDeNoticia(news);

  return (
    <article className="relative isolate flex h-full w-full flex-col justify-end overflow-hidden bg-primary-900">
      <div className="absolute inset-0 -z-10">
        <SafeNewsImage
          src={news.imageKey}
          alt={news.title}
          isLarge
          prioritaria={prioritaria}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-primary-900 via-primary-900/70 to-primary-900/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-gradient-to-r from-primary-900/80 via-primary-900/30 to-transparent md:block"
      />

      <NewsOriginChip news={news} className="absolute top-4 left-4 md:top-6 md:left-6" />

      <div className="max-w-2xl p-5 pb-12 md:p-8 md:pb-14">
        <p className="mb-2 flex flex-wrap items-center gap-x-2 text-xs font-bold tracking-wide uppercase">
          <span className="max-w-full min-w-0 truncate text-accent-300">{fuenteDeNoticia(news)}</span>
          {antiguedad && (
            <>
              <span aria-hidden="true" className="text-white/70">·</span>
              <span className="font-semibold text-white/85 normal-case">{antiguedad}</span>
            </>
          )}
        </p>

        <h3 className="font-display line-clamp-3 text-2xl leading-tight font-extrabold text-white md:text-4xl">
          {news.title}
        </h3>

        {bajada && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/90 md:text-base">
            {bajada}
          </p>
        )}

        <NewsLink
          news={news}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary-900 shadow-sm transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          Leer nota completa
          <span className="sr-only">: {news.title}</span>
          {externa ? (
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </NewsLink>
      </div>
    </article>
  );
}

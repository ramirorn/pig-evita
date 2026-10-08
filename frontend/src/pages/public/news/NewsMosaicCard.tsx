// ===========================================
// NewsMosaicCard — pieza del mosaico "No te pierdas"
// ===========================================
import type { News } from '@/types';
import { SafeNewsImage } from './SafeNewsImage';
import { NewsLink } from './NewsLink';
import { NewsOriginChip } from './NewsOriginChip';
import { antiguedadDeNoticia } from './newsSource';

type Tamano = 'grande' | 'chica';

interface NewsMosaicCardProps {
  news: News;
  tamano?: Tamano;
}

/**
 * Foto de fondo, degradé, chip de origen arriba a la izquierda y el titular
 * abajo con la antigüedad. **El alto lo pone la grilla** (`h-full`): la grande
 * ocupa dos filas y las chicas una, y así el mosaico no depende de alturas
 * fijas que se desalinean con títulos largos.
 *
 * Abajo va la antigüedad, con la fecha de **publicación** —nunca la del
 * sync—. No lleva categoría (el modelo no la tiene) ni contadores de lecturas
 * o comentarios (la plataforma no los registra).
 *
 * El degradé no es decorativo: va de `primary-900` opaco abajo a transparente
 * arriba, y es lo que mantiene el titular blanco por encima de 4.5:1 sobre una
 * foto clara.
 */
export function NewsMosaicCard({ news, tamano = 'chica' }: NewsMosaicCardProps) {
  const antiguedad = antiguedadDeNoticia(news);
  const esGrande = tamano === 'grande';

  return (
    <NewsLink
      news={news}
      className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      <article className="relative isolate flex h-full min-h-56 w-full flex-col justify-end overflow-hidden rounded-2xl bg-primary-900 shadow-sm transition-shadow duration-300 group-hover:shadow-xl">
        <div className="absolute inset-0 -z-10">
          <SafeNewsImage src={news.imageKey} alt={news.title} isLarge={esGrande} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-primary-900 via-primary-900/70 to-transparent"
        />

        <NewsOriginChip news={news} className="absolute top-3 left-3" />

        <div className={esGrande ? 'p-5 md:p-6' : 'p-4'}>
          <h3
            className={
              esGrande
                ? 'font-display line-clamp-3 text-xl leading-tight font-extrabold text-white md:text-2xl'
                : 'line-clamp-3 text-sm leading-snug font-bold text-white md:text-base'
            }
          >
            {news.title}
          </h3>
          {/* Sólo la antigüedad: el origen ya lo dice el chip, y el nombre
              largo de la fuente ("Secretaría de Deportes y Recreación…")
              cortaba la fecha, que es lo que más informa acá. */}
          {antiguedad && (
            <p className="mt-2 text-xs font-medium text-white/85">
              <span className="sr-only">Publicada </span>
              {antiguedad}
            </p>
          )}
        </div>
      </article>
    </NewsLink>
  );
}

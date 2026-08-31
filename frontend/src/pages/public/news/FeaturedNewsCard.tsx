// ===========================================
// FeaturedNewsCard — tarjeta hero de la noticia destacada
// ===========================================
import { ArrowRight, Calendar, ExternalLink, Sparkles } from 'lucide-react';
import type { News } from '@/types';
import { formatDate } from '@/lib/utils';
import { SafeNewsImage } from './SafeNewsImage';
import { BadgeNoticiaExterna, NewsLink } from './NewsLink';
import { esNoticiaExterna } from './newsSource';

/**
 * La primera noticia del listado se muestra con un layout propio (imagen
 * grande + bajada larga). Vive aparte de `NewsCard` porque no comparten
 * markup: unificarlas terminaría en un solo componente lleno de `isLarge`.
 *
 * El reparto de columnas da **más espacio al texto que a la imagen** (7 contra
 * 5). Al revés —que es como estaba— el título quedaba en un tercio del ancho de
 * pantalla y se partía en tres renglones; con una foto apaisada, además, sobraba
 * alto de imagen y faltaba ancho de texto.
 */
export function FeaturedNewsCard({ news }: { news: News }) {
  // S19 — la destacada también puede venir del portal oficial.
  const externa = esNoticiaExterna(news);

  return (
    <NewsLink news={news} className="group block animate-fade-in">
      <div className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl">
        <div className="grid items-stretch md:grid-cols-12">
          {/* Imagen: 5 de 12 en escritorio, y más baja que antes (320 contra
              384) para que la tarjeta entre completa en pantalla. */}
          <div className="relative h-64 overflow-hidden bg-primary-900 md:col-span-6 md:h-80 lg:col-span-5">
            <SafeNewsImage src={news.imageKey} alt={news.title} isLarge />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-950/40 via-transparent to-transparent" />
          </div>

          {/* Texto: 7 de 12. */}
          <div className="flex flex-col justify-between bg-white p-6 md:col-span-6 md:p-8 lg:col-span-7">
            <div>
              {/* Arriba del título va **sólo** el distintivo de destacada. La
                  fecha y el origen bajan debajo: cuatro chips apilados antes
                  del titular empujaban el contenido fuera del pliegue. */}
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-black tracking-wider text-accent-700 uppercase shadow-xs">
                <Sparkles className="h-3.5 w-3.5 text-accent-500" />
                Destacada
              </span>

              <h3 className="mb-3 text-2xl leading-tight font-extrabold text-primary-900 transition-colors group-hover:text-primary-600 md:text-3xl">
                {news.title}
              </h3>

              {/* Fecha y origen en un solo renglón.
                  Acá vivía un "3 min de lectura" **hardcodeado**: el mismo
                  string para toda noticia, sin medir nada. En las que vienen del
                  portal es peor —sólo guardamos la bajada, no hay artículo que
                  medir—, así que se sacó en vez de intentar calcularlo. */}
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(news.createdAt)}
                </span>
                <BadgeNoticiaExterna news={news} />
              </div>

              <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-primary-600 md:text-base">
                {news.excerpt || news.content.substring(0, 180) + '...'}
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-primary-50 pt-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-700 transition-colors group-hover:text-primary-900">
                {externa ? 'Leer en el portal oficial' : 'Leer artículo completo'}
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 transition-all group-hover:bg-primary-600 group-hover:text-white">
                  {externa ? (
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </NewsLink>
  );
}

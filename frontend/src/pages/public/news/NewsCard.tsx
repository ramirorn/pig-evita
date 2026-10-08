// ===========================================
// NewsCard — tarjeta de la grilla secundaria de noticias
// ===========================================
import { ArrowRight, Calendar, ExternalLink } from "lucide-react";
import type { News } from "@/types";
import { SafeNewsImage } from "./SafeNewsImage";
import { NewsLink } from "./NewsLink";
import { NewsOriginChip } from "./NewsOriginChip";
import { bajadaDeNoticia, esNoticiaExterna, fechaDeNoticia } from "./newsSource";

interface NewsCardProps {
  news: News;
  /** Posición en la grilla: sólo define el delay escalonado de la animación. */
  index: number;
}

export function NewsCard({ news, index }: NewsCardProps) {
  // S19 — si la noticia viene del portal oficial, la tarjeta lleva al original.
  // No tenemos el cuerpo del artículo: enlazamos, no republicamos.
  const externa = esNoticiaExterna(news);

  return (
    <NewsLink
      news={news}
      className="animate-fade-in group flex h-full flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="bg-surface-elevated rounded-2xl border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
        {/* Cabecera de Imagen (16:9) */}
        <div className="aspect-video relative overflow-hidden bg-primary-900">
          <SafeNewsImage src={news.imageKey} alt={news.title} />
          {/* Origen y no "Actualidad": ese chip era una categoría fija pintada
              en todas las notas, y el modelo no tiene categorías. */}
          <NewsOriginChip news={news} className="absolute top-3 left-3 z-10" />
        </div>

        {/* Cuerpo de la Tarjeta */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary-600 mb-2">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{fechaDeNoticia(news)}</span>
            </div>

            <h3 className="font-bold text-primary-900 text-lg mb-2.5 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug">
              {news.title}
            </h3>

            <p className="text-primary-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-4">
              {bajadaDeNoticia(news, 120)}
            </p>
          </div>

          {/* Footer de Tarjeta */}
          <div className="pt-3 border-t border-primary-50 flex items-center justify-between text-xs font-bold text-primary-600 group-hover:text-primary-900 transition-colors">
            {/* El texto dice a dónde va, y no "Leer más" para las dos cosas. */}
            <span>{externa ? "Leer en el portal oficial" : "Leer más"}</span>
            {externa ? (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </NewsLink>
  );
}

// ===========================================
// NewsCard — tarjeta de la grilla secundaria de noticias
// ===========================================
import { ArrowRight, Calendar, ExternalLink } from "lucide-react";
import type { News } from "@/types";
import { formatDate } from "@/lib/utils";
import { SafeNewsImage } from "./SafeNewsImage";
import { BadgeNoticiaExterna, NewsLink } from "./NewsLink";
import { esNoticiaExterna } from "./newsSource";

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
      className="animate-fade-in group flex flex-col"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="bg-white rounded-2xl border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full">
        {/* Cabecera de Imagen (16:9) */}
        <div className="aspect-video relative overflow-hidden bg-primary-900">
          <SafeNewsImage src={news.imageKey} alt={news.title} />
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-primary-800 shadow-xs border border-white/40">
              Actualidad
            </span>
            <BadgeNoticiaExterna news={news} className="bg-white/90 backdrop-blur-xs" />
          </div>
        </div>

        {/* Cuerpo de la Tarjeta */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary-400 mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(news.createdAt)}</span>
            </div>

            <h4 className="font-bold text-primary-900 text-lg mb-2.5 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug">
              {news.title}
            </h4>

            <p className="text-primary-600 text-xs sm:text-sm leading-relaxed line-clamp-3 mb-4">
              {news.excerpt || news.content.substring(0, 120) + "..."}
            </p>
          </div>

          {/* Footer de Tarjeta */}
          <div className="pt-3 border-t border-primary-50 flex items-center justify-between text-xs font-bold text-primary-600 group-hover:text-primary-900 transition-colors">
            {/* El texto dice a dónde va, y no "Leer más" para las dos cosas. */}
            <span>{externa ? "Leer en el portal oficial" : "Leer más"}</span>
            {externa ? (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            )}
          </div>
        </div>
      </div>
    </NewsLink>
  );
}

// ===========================================
// FeaturedNewsCard — tarjeta hero de la noticia destacada
// ===========================================
import { Link } from "react-router";
import { ArrowRight, Calendar, Clock, Sparkles } from "lucide-react";
import type { News } from "@/types";
import { formatDate } from "@/lib/utils";
import { SafeNewsImage } from "./SafeNewsImage";

/**
 * La primera noticia del listado se muestra con un layout propio (imagen
 * grande + bajada larga). Vive aparte de `NewsCard` porque no comparten
 * markup: unificarlas terminaría en un solo componente lleno de `isLarge`.
 */
export function FeaturedNewsCard({ news }: { news: News }) {
  return (
    <Link
      to={`/noticias/${news.slug}`}
      className="block group animate-fade-in"
    >
      <div className="bg-white rounded-3xl border border-primary-100 shadow-sm hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        <div className="grid md:grid-cols-12 items-stretch">
          {/* Contenedor de Imagen (5 columnas en desktop) */}
          <div className="md:col-span-6 lg:col-span-7 h-72 md:h-96 relative overflow-hidden bg-primary-900">
            <SafeNewsImage
              src={news.imageKey}
              alt={news.title}
              isLarge
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-950/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Contenedor de Texto (7 columnas en desktop) */}
          <div className="md:col-span-6 lg:col-span-5 p-6 md:p-8 lg:p-10 flex flex-col justify-between bg-white">
            <div>
              {/* Metadatos y Badges */}
              <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-accent-50 text-accent-700 border border-accent-200 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-accent-500" />
                  Destacada
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(news.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 ml-auto hidden sm:inline-flex">
                  <Clock className="w-3.5 h-3.5" />3 min de lectura
                </span>
              </div>

              {/* Título de la Noticia */}
              <h3 className="text-2xl md:text-3xl font-extrabold text-primary-900 group-hover:text-primary-600 transition-colors leading-tight mb-3.5">
                {news.title}
              </h3>

              {/* Resumen / Bajada */}
              <p className="text-primary-600 text-sm md:text-base leading-relaxed line-clamp-3 mb-6">
                {news.excerpt ||
                  news.content.substring(0, 180) + "..."}
              </p>
            </div>

            {/* Botón de llamada a la acción */}
            <div className="pt-4 border-t border-primary-50 flex items-center justify-between">
              <span className="text-primary-700 font-bold text-sm inline-flex items-center gap-2 group-hover:text-primary-900 transition-colors">
                Leer artículo completo
                <div className="w-7 h-7 rounded-full bg-primary-50 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-all">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

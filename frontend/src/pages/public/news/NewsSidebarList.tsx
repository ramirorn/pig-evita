// ===========================================
// NewsSidebarList — lista numerada "Más recientes" de /noticias
// ===========================================
import type { News } from '@/types';
import { NewsLink } from './NewsLink';
import { SafeNewsImage } from './SafeNewsImage';
import { antiguedadDeNoticia, etiquetaDeOrigen } from './newsSource';

interface NewsSidebarListProps {
  news: News[];
}

/**
 * Número, título, "origen · antigüedad" y miniatura a la derecha.
 *
 * ⚠️ **Se llama "Más recientes" y no "Lo más leído" (ni "Top Stories") a
 * propósito.** La plataforma no cuenta visitas: no hay contador en el modelo ni
 * nada que lo alimente. Los números ordenan la lectura por fecha de
 * publicación, y el título de la sección dice eso.
 *
 * Si mañana se agrega un contador de vistas, este componente se reusa cambiando
 * el orden y el título.
 */
export function NewsSidebarList({ news }: NewsSidebarListProps) {
  if (news.length === 0) return null;

  return (
    <ol className="flex flex-col divide-y divide-primary-100">
      {news.map((item, idx) => {
        const antiguedad = antiguedadDeNoticia(item);
        return (
          <li key={item.id} className="py-1.5 first:pt-0 last:pb-0">
            <NewsLink
              news={item}
              className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <article className="flex items-center gap-3 rounded-lg p-1.5 transition-colors group-hover:bg-primary-50">
                <span
                  aria-hidden="true"
                  className="font-display w-6 shrink-0 text-center text-2xl leading-none font-extrabold text-primary-500"
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm leading-snug font-bold text-primary-900 transition-colors group-hover:text-primary-600">
                    {item.title}
                  </h3>
                  <p className="mt-1 truncate text-xs text-primary-600">
                    {etiquetaDeOrigen(item)}
                    {antiguedad && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, </span>
                        {antiguedad}
                      </>
                    )}
                  </p>
                </div>
                <div className="aspect-[5/4] w-16 shrink-0 overflow-hidden rounded-md bg-primary-900">
                  <SafeNewsImage src={item.imageKey} alt={item.title} compacta />
                </div>
              </article>
            </NewsLink>
          </li>
        );
      })}
    </ol>
  );
}

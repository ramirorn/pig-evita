// ===========================================
// NewsSidebarList — lista numerada que acompaña a la destacada
// ===========================================
import type { News } from '@/types';
import { formatDate } from '@/lib/utils';
import { BadgeNoticiaExterna, NewsLink } from './NewsLink';

interface NewsSidebarListProps {
  news: News[];
}

/**
 * Columna lateral de la portada de noticias.
 *
 * ⚠️ **Se llama "Últimas noticias" y no "Lo más leído" a propósito.** El diseño
 * original proponía un ranking de lecturas, pero **la plataforma no cuenta
 * visitas**: no hay contador en el modelo ni nada que lo alimente. Numerar por
 * fecha y rotularlo como "lo más leído" sería inventar una métrica delante del
 * usuario. Los números quedan porque ordenan la lectura; lo que cambia es que el
 * título dice la verdad sobre qué los ordena.
 *
 * Si mañana se agrega un contador de vistas, este componente se reusa cambiando
 * el orden y el título.
 */
export function NewsSidebarList({ news }: NewsSidebarListProps) {
  if (news.length === 0) return null;

  return (
    <ol className="flex flex-col gap-4">
      {news.map((item, idx) => (
        <li key={item.id}>
          <NewsLink news={item} className="group block">
            <article className="flex items-start gap-4 rounded-xl border border-primary-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <span
                aria-hidden="true"
                className="text-4xl leading-none font-extrabold text-primary-100 transition-colors group-hover:text-accent-400"
              >
                {idx + 1}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-primary-500">
                    {formatDate(item.createdAt)}
                  </span>
                  <BadgeNoticiaExterna news={item} />
                </div>
                <h3 className="line-clamp-2 text-sm font-bold text-primary-900 transition-colors group-hover:text-primary-600">
                  {item.title}
                </h3>
              </div>
            </article>
          </NewsLink>
        </li>
      ))}
    </ol>
  );
}

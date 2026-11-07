// ===========================================
// NewsOriginChip — chip de origen sobre la foto de una nota
// ===========================================
import { ExternalLink } from 'lucide-react';
import type { News } from '@/types';
import { cn } from '@/lib/utils';
import { esNoticiaExterna, etiquetaDeOrigen } from './newsSource';

/**
 * Ocupa la ranura que en el diseño de referencia lleva la categoría ("NFL",
 * "MLB"…). Las noticias **no tienen categoría**: lo que se muestra es el origen,
 * que es real y le dice al lector si el enlace lo saca del sitio.
 *
 * Contraste (WCAG, hex del tema): blanco sobre primary-600 9.26:1; blanco sobre
 * secondary-500 5.9:1. Los dos van sobre la foto, con fondo propio opaco.
 */
export function NewsOriginChip({
  news,
  className,
}: {
  news: Pick<News, 'isExternal' | 'sourceUrl'>;
  className?: string;
}) {
  const externa = esNoticiaExterna(news);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] leading-4 font-bold tracking-wide text-white uppercase shadow-sm',
        externa ? 'bg-primary-600' : 'bg-secondary-500',
        className,
      )}
    >
      {externa && <ExternalLink className="h-3 w-3" aria-hidden="true" />}
      {etiquetaDeOrigen(news)}
    </span>
  );
}

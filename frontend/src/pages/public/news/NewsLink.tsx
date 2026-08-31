// ===========================================
// NewsLink — a dónde lleva una noticia, según de dónde venga (S19)
// ===========================================
import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import type { News } from '@/types';
import { cn } from '@/lib/utils';
import { esNoticiaExterna, hostDeLaFuente } from './newsSource';

/**
 * Una noticia propia abre el detalle interno; una traída del portal oficial
 * lleva **al original**, en una pestaña nueva.
 *
 * Es la contracara visible de la decisión de fondo: el sistema **enlaza, no
 * republica**. De la nota ajena guardamos título, bajada, imagen y fecha, y el
 * artículo se lee en formosa.gob.ar. Si la tarjeta llevara a un detalle propio,
 * la pantalla prometería un texto completo que no tenemos.
 */
interface NewsLinkProps {
  news: News;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function NewsLink({ news, className, style, children }: NewsLinkProps) {
  if (esNoticiaExterna(news)) {
    return (
      <a
        href={news.sourceUrl as string}
        target="_blank"
        // `noopener` no es opcional: sin él, la pestaña que abrimos puede
        // manipular `window.opener` y redirigir la nuestra.
        rel="noopener noreferrer"
        className={className}
        style={style}
        aria-label={`${news.title} (se abre en el portal oficial de Formosa)`}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={`/noticias/${news.slug}`} className={className} style={style}>
      {children}
    </Link>
  );
}

/**
 * Cartelito que declara el origen. No es decoración: el lector tiene derecho a
 * saber, **antes** de hacer clic, que el enlace lo saca del sitio.
 */
export function BadgeNoticiaExterna({
  news,
  className,
}: {
  news: Pick<News, 'isExternal' | 'sourceUrl' | 'sourceName'>;
  className?: string;
}) {
  if (!esNoticiaExterna(news)) return null;

  const host = hostDeLaFuente(news.sourceUrl) ?? 'formosa.gob.ar';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
        'bg-celeste-50 text-celeste-900 border border-celeste-200',
        className,
      )}
      title={news.sourceName ?? undefined}
    >
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
      {host}
    </span>
  );
}

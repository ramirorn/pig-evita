// ===========================================
// Origen de una noticia (S19)
// ===========================================
import type { News } from '@/types';

/**
 * Vive aparte de `NewsLink.tsx` por una razón de herramienta y no de gusto:
 * un módulo que exporta componentes **y** funciones sueltas rompe el fast
 * refresh de Vite, y el lint del proyecto lo marca. Las dos helpers se usan
 * también fuera de las tarjetas (el detalle público, por ejemplo), así que el
 * lugar natural es un módulo sin JSX.
 */

/**
 * ¿Esta noticia vino del portal oficial?
 *
 * Se exige `sourceUrl` además del marcador: una fila marcada como externa sin
 * link a dónde ir no es "externa", es una fila rota, y tratarla como externa
 * dejaría una tarjeta que no lleva a ningún lado.
 */
export function esNoticiaExterna(
  news: Pick<News, 'isExternal' | 'sourceUrl'>,
): boolean {
  return Boolean(news.isExternal && news.sourceUrl);
}

/** Host legible de la fuente, para mostrarlo sin la URL entera. */
export function hostDeLaFuente(sourceUrl?: string | null): string | null {
  if (!sourceUrl) return null;
  try {
    return new URL(sourceUrl).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

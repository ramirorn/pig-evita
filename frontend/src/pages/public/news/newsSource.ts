// ===========================================
// Origen de una noticia (S19)
// ===========================================
import type { News } from '@/types';
import { formatDate, tiempoRelativo } from '@/lib/utils';

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

// -------------------------------------------------
// Fecha de una noticia
// -------------------------------------------------

/**
 * La fecha que se muestra (y por la que se ordena) es la de **publicación**.
 *
 * Nunca `createdAt` sola: para una nota del portal, `createdAt` es el momento
 * en que el sync la trajo, y mostrarla hacía que una nota de hace un mes
 * apareciera "de hoy" (o "hace 1 min"). `createdAt` queda sólo como respaldo
 * para una fila sin `publishedAt`, que publicada no debería existir.
 */
export function fechaDePublicacion(
  news: Pick<News, 'publishedAt' | 'createdAt'>,
): string {
  return news.publishedAt ?? news.createdAt;
}

/** Fecha de publicación en formato corto (dd/mm/aaaa). */
export function fechaDeNoticia(
  news: Pick<News, 'publishedAt' | 'createdAt'>,
): string {
  return formatDate(fechaDePublicacion(news));
}

/** Zona de la provincia: "hoy" y "ayer" son los de Formosa, no los del navegador. */
const ZONA_FORMOSA = 'America/Argentina/Buenos_Aires';

/** Día calendario (AAAA-MM-DD) de un instante en la zona de Formosa. */
function diaEnFormosa(fecha: Date): string {
  // `en-CA` formatea como AAAA-MM-DD, que se compara y se parsea sin ambigüedad.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_FORMOSA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/**
 * Antigüedad de una noticia para la línea de "feed" del mosaico.
 *
 * - **Del portal**: el portal publica sólo el día (se guarda anclado a las
 *   12:00 UTC), así que una antigüedad en horas o minutos sería inventada. Se
 *   cuenta en días: "hoy", "ayer", "hace N d" hasta una semana; después, la
 *   fecha.
 * - **Propia**: `publishedAt` es el instante real en que se publicó, y ahí
 *   "hace 3 h" sí dice algo cierto.
 *
 * En ningún caso sale de `createdAt` de una nota sincronizada.
 */
export function antiguedadDeNoticia(
  news: Pick<News, 'publishedAt' | 'createdAt' | 'isExternal' | 'sourceUrl'>,
  ahora: Date = new Date(),
): string {
  const fecha = fechaDePublicacion(news);
  if (!esNoticiaExterna(news)) return tiempoRelativo(fecha);

  const publicada = new Date(fecha);
  if (Number.isNaN(publicada.getTime())) return '';

  const dias = Math.round(
    (Date.parse(diaEnFormosa(ahora)) - Date.parse(diaEnFormosa(publicada))) /
      86_400_000,
  );

  // Una fecha futura (reloj desfasado) no se muestra como "hace -1 d".
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias <= 7) return `hace ${dias} d`;
  return formatDate(fecha);
}

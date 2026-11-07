// ===========================================
// Imagen de noticia — una columna, dos clases de valor
// ===========================================
//
// `News.imageKey` guarda una de dos cosas, y se distinguen por el prefijo:
//
//   · `news/<newsId>/<uuid>-foto.<ext>` → clave de MinIO de una imagen SUBIDA
//     desde el panel (`POST /news/:id/image`). La escribe sólo el backend.
//   · `https://…` → URL EXTERNA: la que se pega en el formulario, o la del
//     portal oficial en las notas sincronizadas (archivos.formosa.gob.ar).
//
// No hizo falta una migración: el DTO sólo acepta URLs `https://` (nunca algo
// que empiece con `news/`), así que por la API no se puede fabricar una clave
// que apunte a otro objeto del bucket.
//
// La respuesta NO lleva `imageKey` (la clave de MinIO no sale de la API):
// lleva `imageUrl` —la ruta del GET propio o la URL externa tal cual— e
// `imageSource`, para que el formulario sepa qué pestaña mostrar sin tener que
// adivinarlo mirando la forma de la URL.
import { rutaDeImagen } from '../images/image.util';

/** Carpeta de MinIO donde viven las imágenes subidas de noticias. */
export const NEWS_IMAGE_FOLDER = 'news';

export type NewsImageSource = 'upload' | 'url';

/** ¿Es la clave de un objeto que subimos nosotros (y no una URL externa)? */
export function esImagenSubida(
  imageKey: string | null | undefined,
): imageKey is string {
  return (
    typeof imageKey === 'string' && imageKey.startsWith(`${NEWS_IMAGE_FOLDER}/`)
  );
}

/** Origen de la imagen de la noticia, o `null` si no tiene. */
export function origenDeImagen(
  imageKey: string | null | undefined,
): NewsImageSource | null {
  if (!imageKey) return null;
  return esImagenSubida(imageKey) ? 'upload' : 'url';
}

/**
 * `imageUrl` de la respuesta: `/api/v1/news/<id>/image?v=<versión>` si se
 * subió, la URL externa tal cual si se pegó (o vino del portal), `null` si no
 * hay imagen.
 */
export function newsImageUrl(
  id: string,
  imageKey: string | null | undefined,
): string | null {
  if (!imageKey) return null;
  return esImagenSubida(imageKey)
    ? rutaDeImagen('news', id, imageKey)
    : imageKey;
}

/** Noticia tal como la devuelve la API: sin `imageKey`, con `imageUrl`. */
export type NewsResponse<T> = Omit<T, 'imageKey'> & {
  imageUrl: string | null;
  imageSource: NewsImageSource | null;
};

/** Reemplaza `imageKey` por `imageUrl` + `imageSource` en una noticia. */
export function toNewsResponse<
  T extends { id: string; imageKey?: string | null },
>(news: T): NewsResponse<T> {
  const { imageKey, ...resto } = news;
  return {
    ...resto,
    imageUrl: newsImageUrl(news.id, imageKey),
    imageSource: origenDeImagen(imageKey),
  };
}

/** `''`, espacios o `null` → `null` (sin imagen); si no, la URL recortada. */
export function normalizarUrlDeImagen(
  valor: string | null | undefined,
): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

// ===========================================
// Foto de sede — helpers compartidos
// ===========================================
//
// `Venue.imageKey` es la clave del objeto en MinIO y NO sale nunca de la API:
// las respuestas publican `imageUrl`, una URL relativa a la API que apunta a
// `GET /venues/:id/image`. El bucket sigue privado y no hay URLs firmadas (se
// vencen y romperían el caché de la página pública).
import { createHash } from 'node:crypto';
import { TIPOS_IMAGEN } from './image-signature.pipe';

/** Tamaño máximo de la foto (lo aplica multer mientras lee el stream). */
export const VENUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Carpeta de MinIO donde viven las fotos de sedes. */
export const VENUE_IMAGE_FOLDER = 'venues';

/**
 * Mismo valor que `app.apiPrefix` (config/index.ts). Se lee del entorno y no
 * del `ConfigService` para que armar la respuesta de una sede siga siendo una
 * función pura, sin dependencias que inyectar.
 */
const API_PREFIX = (process.env.API_PREFIX || 'api/v1').replace(
  /^\/+|\/+$/g,
  '',
);

/**
 * Versión de la foto para la URL: cambia con cada reemplazo porque la clave
 * lleva un UUID nuevo. Es un hash para no filtrar la clave interna.
 */
export function versionDeImagen(imageKey: string): string {
  return createHash('sha256').update(imageKey).digest('hex').slice(0, 12);
}

/** `/api/v1/venues/<id>/image?v=<versión>`, o `null` si no hay foto. */
export function venueImageUrl(
  id: string,
  imageKey: string | null | undefined,
): string | null {
  if (!imageKey) return null;
  return `/${API_PREFIX}/venues/${id}/image?v=${versionDeImagen(imageKey)}`;
}

/** Sede tal como la devuelve la API: sin `imageKey`, con `imageUrl`. */
export type VenueResponse<T> = Omit<T, 'imageKey'> & {
  imageUrl: string | null;
};

/** Reemplaza `imageKey` por `imageUrl` en una sede. */
export function toVenueResponse<
  T extends { id: string; imageKey?: string | null },
>(venue: T): VenueResponse<T> {
  const { imageKey, ...resto } = venue;
  return { ...resto, imageUrl: venueImageUrl(venue.id, imageKey) };
}

/**
 * Content-Type a servir según la extensión de la clave. La clave la arma el
 * backend con la extensión canónica del tipo DETECTADO por firma, así que la
 * extensión es confiable; lo que no sea una imagen conocida no se sirve.
 */
export function contentTypeDeClave(imageKey: string): string | null {
  const extension = imageKey.slice(imageKey.lastIndexOf('.')).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return TIPOS_IMAGEN.jpeg;
    case '.png':
      return TIPOS_IMAGEN.png;
    case '.webp':
      return TIPOS_IMAGEN.webp;
    default:
      return null;
  }
}

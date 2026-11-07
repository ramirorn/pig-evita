// ===========================================
// Foto de sede — helpers propios
// ===========================================
//
// `Venue.imageKey` es la clave del objeto en MinIO y NO sale nunca de la API:
// las respuestas publican `imageUrl`, una URL relativa a la API que apunta a
// `GET /venues/:id/image`. Lo común con las noticias (límite, versión, tipos,
// headers) vive en `images/image.util.ts`.
import { rutaDeImagen } from '../images/image.util';

/** Carpeta de MinIO donde viven las fotos de sedes. */
export const VENUE_IMAGE_FOLDER = 'venues';

/** `/api/v1/venues/<id>/image?v=<versión>`, o `null` si no hay foto. */
export function venueImageUrl(
  id: string,
  imageKey: string | null | undefined,
): string | null {
  if (!imageKey) return null;
  return rutaDeImagen('venues', id, imageKey);
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

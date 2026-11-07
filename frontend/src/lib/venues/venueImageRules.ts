// ===========================================
// Reglas de la foto principal de una sede
// ===========================================
//
// Módulo puro, sin React ni DOM: lo ejercita `scripts/check-venues.mjs`.
//
// La mecánica (límite de 5 MB, JPG/PNG/WebP, clasificación de errores,
// reducción, resolución de la URL contra la API) es común con la imagen de
// noticia y vive en `lib/images/imageRules.ts`, que espeja a
// `backend/src/modules/images/`. Acá quedan los nombres de siempre (para no
// tocar a quien ya los usa) y lo propio de la sede: los mensajes y el alt.
import type { UploadErrorMessage } from '@/lib/uploads/uploaderRules';
import {
  ALLOWED_IMAGE_FORMATS,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_FORMATS_HINT,
  IMAGE_OPTIMIZE_MAX_BYTES,
  IMAGE_OPTIMIZE_MAX_SIDE,
  IMAGE_QUALITY,
  IMAGE_TARGET_SIDE,
  MAX_IMAGE_BYTES,
  buildImageUploaderRules,
  classifyImageError,
  imageErrorKindFromStatus,
  imageMimeOf,
  needsImageOptimization,
  pickSmallerFile,
  renameImageWithExtension,
  resolveApiImageUrl,
  scaledImageSize,
  validateImageFile,
  type AllowedImageMime,
  type ImageErrorKind,
  type ImageValidation,
} from '@/lib/images/imageRules';

// -------------------------------------------------
// Límites y formatos (los comunes, con el nombre de siempre)
// -------------------------------------------------

export const MAX_VENUE_IMAGE_BYTES = MAX_IMAGE_BYTES;
export const ALLOWED_VENUE_IMAGE_FORMATS = ALLOWED_IMAGE_FORMATS;
export type AllowedVenueImageMime = AllowedImageMime;
export const VENUE_IMAGE_ACCEPT_ATTRIBUTE = IMAGE_ACCEPT_ATTRIBUTE;
export const VENUE_IMAGE_FORMATS_HINT = IMAGE_FORMATS_HINT;

// -------------------------------------------------
// Errores
// -------------------------------------------------

export type VenueImageErrorKind = ImageErrorKind;

export const VENUE_IMAGE_ERROR_MESSAGES: Record<VenueImageErrorKind, UploadErrorMessage> = {
  'too-large': {
    title: 'La foto es muy pesada.',
    action: 'El máximo es 5 MB. Exportala más chica o recortala y volvé a elegirla.',
    retryable: false,
  },
  'not-an-image': {
    title: 'Ese archivo no es una imagen de verdad.',
    action: 'Sólo sirven fotos JPG, PNG o WebP: un archivo renombrado no pasa. Elegí la foto original.',
    retryable: false,
  },
  empty: {
    title: 'El archivo está vacío.',
    action: 'Puede que no haya terminado de descargarse. Abrilo para confirmar que se ve y elegilo otra vez.',
    retryable: false,
  },
  network: {
    title: 'Se cortó la conexión y la foto no llegó.',
    action: 'Revisá la señal o el wifi y tocá "Reintentar": no hace falta elegirla de nuevo.',
    retryable: true,
  },
  conflict: {
    title: 'Alguien cambió la foto recién.',
    action: 'Volvé a intentarlo: tu foto va a reemplazar a la que acaban de subir.',
    retryable: true,
  },
  forbidden: {
    title: 'No tenés permiso para cambiar la foto de esta sede.',
    action: 'Si creés que es un error, pedíselo a quien administra el sistema.',
    retryable: false,
  },
  'not-found': {
    title: 'No encontramos esta sede.',
    action: 'Puede que la hayan eliminado. Recargá la página.',
    retryable: false,
  },
  server: {
    title: 'El sistema no pudo guardar la foto.',
    action: 'No es un problema de la foto. Esperá unos minutos y tocá "Reintentar".',
    retryable: true,
  },
};

export const venueImageErrorKindFromStatus = imageErrorKindFromStatus;
export const classifyVenueImageError = classifyImageError;

// -------------------------------------------------
// Validación en el cliente
// -------------------------------------------------

export type VenueImageValidation = ImageValidation;
export const venueImageMimeOf = imageMimeOf;
export const validateVenueImageFile = validateImageFile;

// -------------------------------------------------
// Optimización antes de subir
// -------------------------------------------------

export const VENUE_IMAGE_OPTIMIZE_MAX_SIDE = IMAGE_OPTIMIZE_MAX_SIDE;
export const VENUE_IMAGE_OPTIMIZE_MAX_BYTES = IMAGE_OPTIMIZE_MAX_BYTES;
export const VENUE_IMAGE_TARGET_SIDE = IMAGE_TARGET_SIDE;
export const VENUE_IMAGE_QUALITY = IMAGE_QUALITY;
export const needsVenueImageOptimization = needsImageOptimization;
export const scaledVenueImageSize = scaledImageSize;
export { pickSmallerFile };

/** `cancha.HEIC.png` + `.webp` → `cancha.HEIC.webp` (sin nombre: `foto-sede`). */
export function renameWithExtension(name: string, extension: string): string {
  return renameImageWithExtension(name, extension, 'foto-sede');
}

// -------------------------------------------------
// URL de la foto
// -------------------------------------------------

/** `imageUrl` de la sede (siempre relativa a la API) → `src` usable. */
export const resolveVenueImageUrl = resolveApiImageUrl;

/**
 * Qué `src` pintar: la foto resuelta, salvo que ESA misma URL ya haya fallado
 * al cargar (entonces placeholder). Se compara la URL y no un booleano, como en
 * `SafeNewsImage`: al reemplazar la foto cambia la versión y se vuelve a
 * intentar sin desmontar nada.
 */
export function pickVenueImageSrc(
  imageUrl: string | null | undefined,
  apiBase: string,
  failedSrc: string | null,
): string | null {
  const src = resolveVenueImageUrl(imageUrl, apiBase);
  return src !== null && src !== failedSrc ? src : null;
}

// -------------------------------------------------
// Reglas para el uploader
// -------------------------------------------------

/**
 * Reglas del `DocumentUploader` para la foto de sede. `prepare` (la reducción
 * con canvas) se inyecta desde el componente: acá no hay DOM.
 */
export const VENUE_IMAGE_UPLOADER_RULES = buildImageUploaderRules({
  messages: VENUE_IMAGE_ERROR_MESSAGES,
  doneText: 'Foto subida.',
  announceDone: 'Foto de la sede subida.',
});

/** Texto alternativo de la foto: siempre con el nombre de la sede. */
export function venueImageAlt(name: string): string {
  const limpio = name.trim();
  return limpio ? `Foto de la sede ${limpio}` : 'Foto de la sede';
}

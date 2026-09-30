// ===========================================
// Reglas de la foto principal de una sede
// ===========================================
//
// Módulo puro, sin React ni DOM: lo ejercita `scripts/check-venues.mjs`.
//
// Espeja al backend (`backend/src/modules/venues/`):
//   - `VenueImageUploadInterceptor`: multer corta a los 5 MB
//     (`VENUE_IMAGE_MAX_BYTES`) y responde 422.
//   - `ImageSignaturePipe`: JPEG, PNG o WebP por los magic bytes; la extensión
//     declarada tiene que coincidir con el contenido → 400.
//   - 409 cuando otra operación cambió la foto mientras se procesaba.
//
// Como en documentos, lo de acá es una cortesía para no gastar datos en algo
// que el backend va a rechazar: un archivo renombrado pasa este filtro y lo
// frena el pipe.
import { getHttpStatus, safeImageSrc } from '@/lib/utils';
import type {
  UploadErrorMessage,
  UploadFileLike,
  UploaderRules,
} from '@/lib/uploads/uploaderRules';

// -------------------------------------------------
// Límites y formatos
// -------------------------------------------------

/** Mismo número que `VENUE_IMAGE_MAX_BYTES` del backend. */
export const MAX_VENUE_IMAGE_BYTES = 5 * 1024 * 1024;

/** MIME canónico → extensiones que el `ImageSignaturePipe` acepta para él. */
export const ALLOWED_VENUE_IMAGE_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const satisfies Record<string, readonly string[]>;

export type AllowedVenueImageMime = keyof typeof ALLOWED_VENUE_IMAGE_FORMATS;

export const VENUE_IMAGE_ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_VENUE_IMAGE_FORMATS).join(',');

export const VENUE_IMAGE_FORMATS_HINT = 'JPG, PNG o WebP de hasta 5 MB';

// -------------------------------------------------
// Errores
// -------------------------------------------------

export type VenueImageErrorKind =
  /** 422/413 o el control local de tamaño. */
  | 'too-large'
  /** 400/415: el contenido no es una imagen JPG/PNG/WebP (o no coincide con la extensión). */
  | 'not-an-image'
  /** Archivo de 0 bytes. */
  | 'empty'
  /** Sin respuesta: señal caída, timeout, servidor inalcanzable. */
  | 'network'
  /** 409: otra persona (u otra pestaña) cambió la foto al mismo tiempo. */
  | 'conflict'
  /** 401/403. */
  | 'forbidden'
  /** 404: la sede ya no existe. */
  | 'not-found'
  /** 5xx o cualquier otra cosa. */
  | 'server';

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

/** Estado HTTP → tipo de error. `null` es "no hubo respuesta". */
export function venueImageErrorKindFromStatus(status: number | null): VenueImageErrorKind {
  if (status === null) return 'network';
  if (status === 413 || status === 422) return 'too-large';
  if (status === 400 || status === 415) return 'not-an-image';
  if (status === 409) return 'conflict';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'server';
}

export function classifyVenueImageError(error: unknown): VenueImageErrorKind {
  return venueImageErrorKindFromStatus(getHttpStatus(error));
}

// -------------------------------------------------
// Validación en el cliente
// -------------------------------------------------

export type VenueImageValidation =
  | { ok: true; mime: AllowedVenueImageMime }
  | { ok: false; kind: VenueImageErrorKind };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function mimeForExtension(extension: string): AllowedVenueImageMime | null {
  for (const [mime, extensions] of Object.entries(ALLOWED_VENUE_IMAGE_FORMATS)) {
    if ((extensions as readonly string[]).includes(extension)) return mime as AllowedVenueImageMime;
  }
  return null;
}

/** ¿El nombre/MIME dicen que es una imagen de las que acepta el backend? */
export function venueImageMimeOf(file: UploadFileLike): AllowedVenueImageMime | null {
  const byExtension = mimeForExtension(extensionOf(file.name));
  if (!byExtension) return null;
  const declared = file.type.trim().toLowerCase();
  const normalized = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (normalized !== '' && normalized !== byExtension) return null;
  return byExtension;
}

/** Orden: vacío → tamaño → formato (igual que documentos). */
export function validateVenueImageFile(file: UploadFileLike): VenueImageValidation {
  if (file.size <= 0) return { ok: false, kind: 'empty' };
  if (file.size > MAX_VENUE_IMAGE_BYTES) return { ok: false, kind: 'too-large' };
  const mime = venueImageMimeOf(file);
  if (!mime) return { ok: false, kind: 'not-an-image' };
  return { ok: true, mime };
}

// -------------------------------------------------
// Optimización antes de subir (decisiones puras; el canvas vive aparte)
// -------------------------------------------------

/** Por encima de este lado (px) vale la pena reducir. */
export const VENUE_IMAGE_OPTIMIZE_MAX_SIDE = 2000;
/** Por encima de este peso vale la pena re-codificar. */
export const VENUE_IMAGE_OPTIMIZE_MAX_BYTES = 1.5 * 1024 * 1024;
/** Lado mayor de la foto reducida: sobra para una portada de tarjeta. */
export const VENUE_IMAGE_TARGET_SIDE = 1600;
/** Calidad de WebP/JPEG al re-codificar. */
export const VENUE_IMAGE_QUALITY = 0.85;

export function needsVenueImageOptimization(input: {
  size: number;
  width: number;
  height: number;
}): boolean {
  return (
    input.size > VENUE_IMAGE_OPTIMIZE_MAX_BYTES ||
    Math.max(input.width, input.height) > VENUE_IMAGE_OPTIMIZE_MAX_SIDE
  );
}

/** Medidas para que el lado mayor sea `maxSide` (nunca agranda). */
export function scaledVenueImageSize(
  width: number,
  height: number,
  maxSide: number = VENUE_IMAGE_TARGET_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** `cancha.HEIC.png` + `.webp` → `cancha.HEIC.webp`. La extensión tiene que coincidir con el contenido. */
export function renameWithExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name) || 'foto-sede';
  return `${base}${extension}`;
}

/** Si la versión optimizada no achica, se sube la original. */
export function pickSmallerFile<T extends { size: number }>(original: T, optimized: T | null): T {
  return optimized && optimized.size > 0 && optimized.size < original.size ? optimized : original;
}

// -------------------------------------------------
// URL de la foto
// -------------------------------------------------

/**
 * Origen de la API a partir de la base configurada.
 * `''` = relativa (mismo origen); `null` = base inválida.
 */
function apiOriginOf(apiBase: string): string | null {
  const base = apiBase.trim();
  if (base === '' || (base.startsWith('/') && !base.startsWith('//'))) return '';
  try {
    const url = new URL(base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Ruta absoluta del sitio con query simple: `/api/v1/venues/<id>/image?v=abc123`. */
const RUTA_DE_IMAGEN = /^\/(?!\/)[A-Za-z0-9._~%/-]*(?:\?[A-Za-z0-9._~%=&-]*)?$/;

/**
 * `imageUrl` de la API → `src` usable.
 *
 * El backend manda una ruta relativa al ORIGEN de la API (incluye `/api/v1`).
 * Con la API en el mismo origen (Docker) se usa tal cual; con
 * `VITE_API_BASE_URL` absoluta se le antepone el origen de esa base. Cualquier
 * otra forma (esquemas raros, `//host`, URLs absolutas del backend) se
 * descarta: el host lo decide nuestra configuración, nunca el dato.
 */
export function resolveVenueImageUrl(
  imageUrl: string | null | undefined,
  apiBase: string,
): string | null {
  if (typeof imageUrl !== 'string') return null;
  const ruta = imageUrl.trim();
  if (!RUTA_DE_IMAGEN.test(ruta)) return null;
  // Segunda red: el mismo filtro que las imágenes de noticias.
  if (safeImageSrc(ruta) === null) return null;
  const origin = apiOriginOf(apiBase);
  if (origin === null) return null;
  return `${origin}${ruta}`;
}

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
export const VENUE_IMAGE_UPLOADER_RULES: UploaderRules = {
  accept: VENUE_IMAGE_ACCEPT_ATTRIBUTE,
  cameraAccept: 'image/jpeg,image/png',
  formatsHint: VENUE_IMAGE_FORMATS_HINT,
  validate: (file) => {
    const result = validateVenueImageFile(file);
    return result.ok
      ? { ok: true, preview: 'image' }
      : { ok: false, error: VENUE_IMAGE_ERROR_MESSAGES[result.kind] };
  },
  describeError: (error) => VENUE_IMAGE_ERROR_MESSAGES[classifyVenueImageError(error)],
  doneText: 'Foto subida.',
  announceDone: () => 'Foto de la sede subida.',
};

/** Texto alternativo de la foto: siempre con el nombre de la sede. */
export function venueImageAlt(name: string): string {
  const limpio = name.trim();
  return limpio ? `Foto de la sede ${limpio}` : 'Foto de la sede';
}

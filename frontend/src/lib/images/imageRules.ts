// ===========================================
// Reglas comunes de las imágenes subidas (foto de sede, imagen de noticia)
// ===========================================
//
// Módulo puro, sin React ni DOM: lo ejercitan `check:venues` y
// `check:news-images`.
//
// Espeja al backend (`backend/src/modules/images/`):
//   - `ImageUploadInterceptor`: multer corta a los 5 MB (`IMAGE_MAX_BYTES`) y
//     responde 422.
//   - `ImageSignaturePipe`: JPEG, PNG o WebP por los magic bytes; la extensión
//     declarada tiene que coincidir con el contenido → 400.
//   - 409 cuando otra operación cambió la imagen mientras se procesaba.
//
// Lo de acá es una cortesía para no gastar datos en algo que el backend va a
// rechazar: un archivo renombrado pasa este filtro y lo frena el pipe. Los
// MENSAJES son de cada dominio (sede, noticia): acá sólo está la mecánica.
import { getHttpStatus, safeImageSrc } from '@/lib/utils';
import type {
  UploadErrorMessage,
  UploadFileLike,
  UploaderRules,
} from '@/lib/uploads/uploaderRules';

// -------------------------------------------------
// Límites y formatos
// -------------------------------------------------

/** Mismo número que `IMAGE_MAX_BYTES` del backend. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** MIME canónico → extensiones que el `ImageSignaturePipe` acepta para él. */
export const ALLOWED_IMAGE_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const satisfies Record<string, readonly string[]>;

export type AllowedImageMime = keyof typeof ALLOWED_IMAGE_FORMATS;

export const IMAGE_ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_IMAGE_FORMATS).join(',');

export const IMAGE_FORMATS_HINT = 'JPG, PNG o WebP de hasta 5 MB';

// -------------------------------------------------
// Errores
// -------------------------------------------------

export type ImageErrorKind =
  /** 422/413 o el control local de tamaño. */
  | 'too-large'
  /** 400/415: el contenido no es una imagen JPG/PNG/WebP (o no coincide con la extensión). */
  | 'not-an-image'
  /** Archivo de 0 bytes. */
  | 'empty'
  /** Sin respuesta: señal caída, timeout, servidor inalcanzable. */
  | 'network'
  /** 409: otra persona (u otra pestaña) cambió la imagen al mismo tiempo. */
  | 'conflict'
  /** 401/403. */
  | 'forbidden'
  /** 404: lo que tenía la imagen ya no existe. */
  | 'not-found'
  /** 5xx o cualquier otra cosa. */
  | 'server';

export type ImageErrorMessages = Record<ImageErrorKind, UploadErrorMessage>;

/** Estado HTTP → tipo de error. `null` es "no hubo respuesta". */
export function imageErrorKindFromStatus(status: number | null): ImageErrorKind {
  if (status === null) return 'network';
  if (status === 413 || status === 422) return 'too-large';
  if (status === 400 || status === 415) return 'not-an-image';
  if (status === 409) return 'conflict';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'server';
}

export function classifyImageError(error: unknown): ImageErrorKind {
  return imageErrorKindFromStatus(getHttpStatus(error));
}

// -------------------------------------------------
// Validación en el cliente
// -------------------------------------------------

export type ImageValidation =
  | { ok: true; mime: AllowedImageMime }
  | { ok: false; kind: ImageErrorKind };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function mimeForExtension(extension: string): AllowedImageMime | null {
  for (const [mime, extensions] of Object.entries(ALLOWED_IMAGE_FORMATS)) {
    if ((extensions as readonly string[]).includes(extension)) return mime as AllowedImageMime;
  }
  return null;
}

/** ¿El nombre/MIME dicen que es una imagen de las que acepta el backend? */
export function imageMimeOf(file: UploadFileLike): AllowedImageMime | null {
  const byExtension = mimeForExtension(extensionOf(file.name));
  if (!byExtension) return null;
  const declared = file.type.trim().toLowerCase();
  const normalized = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (normalized !== '' && normalized !== byExtension) return null;
  return byExtension;
}

/** Orden: vacío → tamaño → formato (igual que documentos). */
export function validateImageFile(file: UploadFileLike): ImageValidation {
  if (file.size <= 0) return { ok: false, kind: 'empty' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, kind: 'too-large' };
  const mime = imageMimeOf(file);
  if (!mime) return { ok: false, kind: 'not-an-image' };
  return { ok: true, mime };
}

// -------------------------------------------------
// Optimización antes de subir (decisiones puras; el canvas vive aparte)
// -------------------------------------------------

/** Por encima de este lado (px) vale la pena reducir. */
export const IMAGE_OPTIMIZE_MAX_SIDE = 2000;
/** Por encima de este peso vale la pena re-codificar. */
export const IMAGE_OPTIMIZE_MAX_BYTES = 1.5 * 1024 * 1024;
/** Lado mayor de la imagen reducida: sobra para una portada. */
export const IMAGE_TARGET_SIDE = 1600;
/** Calidad de WebP/JPEG al re-codificar. */
export const IMAGE_QUALITY = 0.85;

export function needsImageOptimization(input: {
  size: number;
  width: number;
  height: number;
}): boolean {
  return (
    input.size > IMAGE_OPTIMIZE_MAX_BYTES ||
    Math.max(input.width, input.height) > IMAGE_OPTIMIZE_MAX_SIDE
  );
}

/** Medidas para que el lado mayor sea `maxSide` (nunca agranda). */
export function scaledImageSize(
  width: number,
  height: number,
  maxSide: number = IMAGE_TARGET_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * `cancha.HEIC.png` + `.webp` → `cancha.HEIC.webp`. La extensión tiene que
 * coincidir con el contenido. `fallbackBase` es el nombre si no queda ninguno.
 */
export function renameImageWithExtension(name: string, extension: string, fallbackBase = 'imagen'): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name) || fallbackBase;
  return `${base}${extension}`;
}

/** Si la versión optimizada no achica, se sube la original. */
export function pickSmallerFile<T extends { size: number }>(original: T, optimized: T | null): T {
  return optimized && optimized.size > 0 && optimized.size < original.size ? optimized : original;
}

// -------------------------------------------------
// URL de una imagen servida por la API
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

/** Ruta absoluta del sitio con query simple: `/api/v1/<recurso>/<id>/image?v=abc123`. */
const RUTA_DE_IMAGEN = /^\/(?!\/)[A-Za-z0-9._~%/-]*(?:\?[A-Za-z0-9._~%=&-]*)?$/;

/**
 * `imageUrl` RELATIVA de la API → `src` usable.
 *
 * El backend manda una ruta relativa al ORIGEN de la API (incluye `/api/v1`).
 * Con la API en el mismo origen (Docker) se usa tal cual; con
 * `VITE_API_BASE_URL` absoluta se le antepone el origen de esa base. Cualquier
 * otra forma (esquemas raros, `//host`, URLs absolutas) se descarta: el host
 * lo decide nuestra configuración, nunca el dato.
 */
export function resolveApiImageUrl(
  imageUrl: string | null | undefined,
  apiBase: string,
): string | null {
  if (typeof imageUrl !== 'string') return null;
  const ruta = imageUrl.trim();
  if (!RUTA_DE_IMAGEN.test(ruta)) return null;
  // Segunda red: el mismo filtro que cualquier imagen que llega del backend.
  if (safeImageSrc(ruta) === null) return null;
  const origin = apiOriginOf(apiBase);
  if (origin === null) return null;
  return `${origin}${ruta}`;
}

// -------------------------------------------------
// Reglas para el uploader
// -------------------------------------------------

/**
 * Reglas del `DocumentUploader` para una imagen, con los mensajes del dominio.
 * `prepare` (la reducción con canvas) se inyecta desde el componente: acá no
 * hay DOM.
 */
export function buildImageUploaderRules(config: {
  messages: ImageErrorMessages;
  doneText: string;
  announceDone: string;
}): UploaderRules {
  return {
    accept: IMAGE_ACCEPT_ATTRIBUTE,
    cameraAccept: 'image/jpeg,image/png',
    formatsHint: IMAGE_FORMATS_HINT,
    validate: (file) => {
      const result = validateImageFile(file);
      return result.ok
        ? { ok: true, preview: 'image' }
        : { ok: false, error: config.messages[result.kind] };
    },
    describeError: (error) => config.messages[classifyImageError(error)],
    doneText: config.doneText,
    announceDone: () => config.announceDone,
  };
}

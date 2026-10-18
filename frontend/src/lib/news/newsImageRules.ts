// ===========================================
// Imagen de una noticia — reglas y resolución de la URL
// ===========================================
//
// Módulo puro, sin React ni DOM: lo ejercita `scripts/check-news-images.mjs`.
//
// La imagen de una noticia es de una de dos clases (backend:
// `news/news-image.util.ts`), y `imageUrl` las trae ya distinguidas:
//
//   · SUBIDA desde el panel → `imageUrl` es una ruta relativa a la API
//     (`/api/v1/news/<id>/image?v=<versión>`), `imageSource: 'upload'`.
//   · URL EXTERNA (pegada en el formulario, o la del portal en las notas
//     sincronizadas) → `imageUrl` es la URL `https://` tal cual,
//     `imageSource: 'url'`.
//
// La subida usa la misma mecánica que la foto de sede (`lib/images/`): mismo
// límite, mismos formatos, misma reducción. Acá van los mensajes propios.
import { API_BASE_URL } from '@/lib/apiBase';
import { safeImageSrc } from '@/lib/utils';
import type { UploadErrorMessage } from '@/lib/uploads/uploaderRules';
import {
  buildImageUploaderRules,
  resolveApiImageUrl,
  type ImageErrorKind,
} from '@/lib/images/imageRules';

// -------------------------------------------------
// Errores
// -------------------------------------------------

export const NEWS_IMAGE_ERROR_MESSAGES: Record<ImageErrorKind, UploadErrorMessage> = {
  'too-large': {
    title: 'La imagen es muy pesada.',
    action: 'El máximo es 5 MB. Exportala más chica o recortala y volvé a elegirla.',
    retryable: false,
  },
  'not-an-image': {
    title: 'Ese archivo no es una imagen de verdad.',
    action: 'Sólo sirven imágenes JPG, PNG o WebP: un archivo renombrado no pasa. Elegí la imagen original.',
    retryable: false,
  },
  empty: {
    title: 'El archivo está vacío.',
    action: 'Puede que no haya terminado de descargarse. Abrilo para confirmar que se ve y elegilo otra vez.',
    retryable: false,
  },
  network: {
    title: 'Se cortó la conexión y la imagen no llegó.',
    action: 'Revisá la señal o el wifi y tocá "Reintentar": no hace falta elegirla de nuevo.',
    retryable: true,
  },
  conflict: {
    title: 'Alguien cambió la imagen de esta noticia recién.',
    action: 'Volvé a intentarlo: tu imagen va a reemplazar a la que acaban de poner.',
    retryable: true,
  },
  forbidden: {
    title: 'No se puede cambiar la imagen de esta noticia.',
    action: 'Puede que no tengas permiso, o que la nota venga del portal oficial (ésas se administran allá).',
    retryable: false,
  },
  'not-found': {
    title: 'No encontramos esta noticia.',
    action: 'Puede que la hayan eliminado. Recargá la página.',
    retryable: false,
  },
  server: {
    title: 'El sistema no pudo guardar la imagen.',
    action: 'No es un problema de la imagen. Esperá unos minutos y tocá "Reintentar".',
    retryable: true,
  },
};

/**
 * Reglas del `DocumentUploader` para la imagen de noticia. `prepare` (la
 * reducción con canvas) se inyecta desde el componente: acá no hay DOM.
 */
export const NEWS_IMAGE_UPLOADER_RULES = buildImageUploaderRules({
  messages: NEWS_IMAGE_ERROR_MESSAGES,
  doneText: 'Imagen subida.',
  announceDone: 'Imagen de la noticia subida.',
});

// -------------------------------------------------
// URL de la imagen
// -------------------------------------------------

/**
 * `imageUrl` de una noticia → `src` usable, o `null` (placeholder).
 *
 * - Ruta relativa (`/api/v1/news/…`): se resuelve contra el ORIGEN de la API,
 *   como la foto de sede. El host lo pone nuestra configuración.
 * - URL absoluta: es externa y pasa por `safeImageSrc` (sólo `https:`; nada
 *   de `javascript:`, `data:`, `//host`).
 */
export function resolveNewsImageUrl(
  imageUrl: string | null | undefined,
  apiBase: string,
): string | null {
  if (typeof imageUrl !== 'string') return null;
  const valor = imageUrl.trim();
  if (valor === '') return null;
  if (valor.startsWith('/') && !valor.startsWith('//')) {
    return resolveApiImageUrl(valor, apiBase);
  }
  // Una relativa sin barra (`noticias/foo.jpg`) no es algo que mande esta API:
  // sólo se aceptan las absolutas, y de ésas sólo `https:`.
  if (!/^https:\/\//i.test(valor)) return null;
  return safeImageSrc(valor);
}

/** `resolveNewsImageUrl` contra la base configurada de la API. */
export function newsImageSrc(imageUrl: string | null | undefined): string | null {
  return resolveNewsImageUrl(imageUrl, API_BASE_URL);
}

/**
 * ¿La URL que se está tipeando en "Pegar URL" sirve? Mismo criterio que el
 * backend (`@IsUrl` con `https` obligatorio) y que la página pública.
 */
export function isValidExternalImageUrl(value: string): boolean {
  const limpio = value.trim();
  if (!/^https:\/\//i.test(limpio)) return false;
  try {
    const url = new URL(limpio);
    return url.protocol === 'https:' && url.hostname.includes('.') && safeImageSrc(limpio) !== null;
  } catch {
    return false;
  }
}

// -------------------------------------------------
// Qué mandar en el PATCH desde "Pegar URL"
// -------------------------------------------------

export type NewsImageSource = 'upload' | 'url';

/**
 * Valor de `imageKey` para el body del formulario, o `undefined` para no
 * tocar la imagen.
 *
 * - En "Subir archivo" el formulario no manda nada: la subida se guarda sola.
 * - En "Pegar URL" con una URL: se manda (si la anterior era subida, el
 *   backend borra el objeto).
 * - En "Pegar URL" vacío: sólo quita la imagen si la que había ERA una URL.
 *   Cambiar de pestaña con el campo vacío no borra una imagen subida: para eso
 *   está "Quitar imagen", que pide confirmación.
 */
export function imageKeyForPayload(input: {
  mode: NewsImageSource;
  value: string | null | undefined;
  currentSource: NewsImageSource | null;
  currentUrl: string | null;
}): string | null | undefined {
  if (input.mode !== 'url') return undefined;
  const value = (input.value ?? '').trim();
  if (value !== '') return value === input.currentUrl && input.currentSource === 'url' ? undefined : value;
  return input.currentSource === 'url' ? null : undefined;
}

/** Texto alternativo de la imagen: el título de la noticia. */
export function newsImageAlt(title: string): string {
  const limpio = title.trim();
  return limpio ? `Imagen de la noticia ${limpio}` : 'Imagen de la noticia';
}

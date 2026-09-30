// ===========================================
// Reglas de la carga de documentos (DNI, ficha médica y resto)
// ===========================================
//
// Módulo puro, sin React: todo lo que acá se decide lo ejercita
// `scripts/check-documents.mjs` sin montar un solo componente.
//
// Espeja al backend (`backend/src/modules/documents/`):
//   - `ParseFilePipeBuilder.addMaxSizeValidator({ maxSize: 5 MB })` → 422.
//   - `FileSignaturePipe` mira los magic bytes: sólo PDF, PNG y JPEG, y la
//     extensión declarada tiene que coincidir con el contenido → 400.
//
// La validación de acá es una **cortesía** para no gastar datos móviles en un
// archivo que el backend va a rechazar. No reemplaza a la del servidor: un
// archivo renombrado pasa este filtro (no leemos bytes) y lo frena el pipe.
import { DocumentStatus, DocumentType, type DocumentEntity } from '@/types';
import { getHttpStatus } from '@/lib/utils';
import type { UploaderRules } from '@/lib/uploads/uploaderRules';

// -------------------------------------------------
// Límites y formatos
// -------------------------------------------------

/** Mismo número que el `maxSize` del controller. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** MIME canónico → extensiones que el `FileSignaturePipe` acepta para él. */
export const ALLOWED_DOCUMENT_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
} as const satisfies Record<string, readonly string[]>;

export type AllowedDocumentMime = keyof typeof ALLOWED_DOCUMENT_FORMATS;

/** Valor del atributo `accept` del `<input type="file">`. */
export const DOCUMENT_ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_DOCUMENT_FORMATS).join(',');

/** Texto corto para la ayuda del campo. */
export const DOCUMENT_FORMATS_HINT = 'JPG, PNG o PDF de hasta 5 MB';

// -------------------------------------------------
// Etiquetas de tipos
// -------------------------------------------------

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.DNI_FRENTE]: 'DNI (frente)',
  [DocumentType.DNI_DORSO]: 'DNI (dorso)',
  [DocumentType.CERTIFICADO_MEDICO]: 'Ficha médica',
  [DocumentType.AUTORIZACION_PARENTAL]: 'Autorización de madre, padre o tutor',
  [DocumentType.FOTO]: 'Foto carnet',
  [DocumentType.OTRO]: 'Otro',
};

/** Ayuda que acompaña a cada tipo en el uploader. */
export const DOCUMENT_TYPE_HINTS: Record<DocumentType, string> = {
  [DocumentType.DNI_FRENTE]: 'Foto del lado con la cara, que se lean nombre y número.',
  [DocumentType.DNI_DORSO]: 'Foto del lado de atrás, con el domicilio a la vista.',
  [DocumentType.CERTIFICADO_MEDICO]: 'La ficha firmada y sellada por el médico.',
  [DocumentType.AUTORIZACION_PARENTAL]: 'Firmada por la persona a cargo del menor.',
  [DocumentType.FOTO]: 'Foto de frente, con fondo liso.',
  [DocumentType.OTRO]: 'Cualquier papel que te hayan pedido aparte.',
};

/** Los tres papeles que se piden a todos: van primero y con nombre propio. */
export const FEATURED_DOCUMENT_TYPES = [
  DocumentType.DNI_FRENTE,
  DocumentType.DNI_DORSO,
  DocumentType.CERTIFICADO_MEDICO,
] as const;

/** El resto del enum: accesible desde un selector "Otro documento". */
export const SECONDARY_DOCUMENT_TYPES: DocumentType[] = Object.values(DocumentType).filter(
  (type) => !(FEATURED_DOCUMENT_TYPES as readonly DocumentType[]).includes(type),
);

export function isDocumentType(value: string): value is DocumentType {
  return (Object.values(DocumentType) as string[]).includes(value);
}

// -------------------------------------------------
// Estados del documento (clases completas, nunca interpoladas)
// -------------------------------------------------

export const DOCUMENT_STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  [DocumentStatus.PENDIENTE]: 'bg-amber-100 text-amber-800 border-amber-200',
  [DocumentStatus.APROBADO]: 'bg-green-100 text-green-800 border-green-200',
  [DocumentStatus.RECHAZADO]: 'bg-red-100 text-red-800 border-red-200',
};

// -------------------------------------------------
// Errores: una sola tabla para el cliente y para el servidor
// -------------------------------------------------

export type DocumentErrorKind =
  /** 422/413 o el control local de tamaño. */
  | 'too-large'
  /** 400/415 del `FileSignaturePipe`, o extensión/MIME que no cierran. */
  | 'wrong-type'
  /** Archivo de 0 bytes (pasa con fotos que no terminaron de bajar de la nube). */
  | 'empty'
  /** Sin respuesta: se cayó la señal, timeout, servidor inalcanzable. */
  | 'network'
  /** 401/403: la sesión no alcanza para subir papeles de este participante. */
  | 'forbidden'
  /** 404: el participante no existe o está fuera de tu alcance. */
  | 'not-found'
  /** 5xx o cualquier otra cosa. */
  | 'server';

export interface DocumentErrorMessage {
  /** Qué pasó, en una línea. */
  title: string;
  /** Qué tiene que hacer la persona ahora. */
  action: string;
  /** Si tiene sentido ofrecer "Reintentar" con el mismo archivo. */
  retryable: boolean;
}

export const DOCUMENT_ERROR_MESSAGES: Record<DocumentErrorKind, DocumentErrorMessage> = {
  'too-large': {
    title: 'El archivo es muy pesado.',
    action:
      'El máximo es 5 MB. Sacá otra foto con menos resolución, recortala o escaneá el papel en menor calidad y volvé a elegirla.',
    retryable: false,
  },
  'wrong-type': {
    title: 'El archivo no es lo que dice ser.',
    action:
      'Sólo sirven fotos JPG o PNG y documentos PDF de verdad: un archivo renombrado no pasa. Elegí el archivo original o sacá la foto de nuevo.',
    retryable: false,
  },
  empty: {
    title: 'El archivo está vacío.',
    action: 'Puede que no haya terminado de descargarse. Abrilo en el teléfono para confirmar que se ve y elegilo otra vez.',
    retryable: false,
  },
  network: {
    title: 'Se cortó la conexión y el archivo no llegó.',
    action: 'Revisá la señal o el wifi y tocá "Reintentar": no hace falta elegir el archivo de nuevo.',
    retryable: true,
  },
  forbidden: {
    title: 'No tenés permiso para subir papeles de este participante.',
    action: 'Si creés que es un error, pedíselo a quien administra tu delegación.',
    retryable: false,
  },
  'not-found': {
    title: 'No encontramos a este participante.',
    action: 'Recargá la página. Si sigue pasando, la inscripción puede haberse dado de baja.',
    retryable: false,
  },
  server: {
    title: 'El sistema no pudo guardar el archivo.',
    action: 'No es un problema del archivo. Esperá unos minutos y tocá "Reintentar".',
    retryable: true,
  },
};

/** Estado HTTP → tipo de error. `null` es "no hubo respuesta". */
export function documentErrorKindFromStatus(status: number | null): DocumentErrorKind {
  if (status === null) return 'network';
  if (status === 413 || status === 422) return 'too-large';
  if (status === 400 || status === 415) return 'wrong-type';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'server';
}

/** Error de Axios (o cualquier cosa) → tipo de error del uploader. */
export function classifyUploadError(error: unknown): DocumentErrorKind {
  return documentErrorKindFromStatus(getHttpStatus(error));
}

/** Axios aborta con `CanceledError` (`code: 'ERR_CANCELED'`): no es un fallo. */
export function isCanceledUpload(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, name } = error as { code?: unknown; name?: unknown };
  return code === 'ERR_CANCELED' || name === 'CanceledError' || name === 'AbortError';
}

// -------------------------------------------------
// Validación en el cliente
// -------------------------------------------------

/** Lo mínimo de un `File` que hace falta mirar (así se prueba sin DOM). */
export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export type DocumentPreviewKind = 'image' | 'pdf';

export type DocumentFileValidation =
  | { ok: true; mime: AllowedDocumentMime; preview: DocumentPreviewKind }
  | { ok: false; kind: DocumentErrorKind };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function mimeForExtension(extension: string): AllowedDocumentMime | null {
  for (const [mime, extensions] of Object.entries(ALLOWED_DOCUMENT_FORMATS)) {
    if ((extensions as readonly string[]).includes(extension)) return mime as AllowedDocumentMime;
  }
  return null;
}

/**
 * Decide si vale la pena mandar el archivo.
 *
 * Orden: vacío → tamaño → formato. El tamaño va antes que el formato porque
 * "muy pesado" le dice exactamente qué hacer a quien sacó una foto de 8 MB con
 * el teléfono, que es el caso más común.
 *
 * La extensión manda; el MIME, si viene, tiene que coincidir. Hay navegadores
 * de Android que entregan `type: ''` para archivos del almacenamiento: en ese
 * caso alcanza con la extensión (y el backend igual mira los bytes).
 */
export function validateDocumentFile(file: FileLike): DocumentFileValidation {
  if (file.size <= 0) return { ok: false, kind: 'empty' };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, kind: 'too-large' };

  const byExtension = mimeForExtension(extensionOf(file.name));
  if (!byExtension) return { ok: false, kind: 'wrong-type' };

  const declared = file.type.trim().toLowerCase();
  // `image/jpg` no es un MIME registrado pero hay navegadores que lo mandan.
  const normalized = declared === 'image/jpg' ? 'image/jpeg' : declared;
  if (normalized !== '' && normalized !== byExtension) return { ok: false, kind: 'wrong-type' };

  return {
    ok: true,
    mime: byExtension,
    preview: byExtension === 'application/pdf' ? 'pdf' : 'image',
  };
}

// -------------------------------------------------
// Presentación
// -------------------------------------------------

/** Progreso de Axios (`loaded`/`total`) → entero 0..100, o `null` si no se sabe. */
export function uploadPercent(loaded: number, total: number | undefined): number | null {
  if (!total || total <= 0 || !Number.isFinite(loaded)) return null;
  return Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
}

/**
 * Reglas del `DocumentUploader` para papeles (su valor por defecto).
 *
 * Es la misma validación, los mismos formatos y los mismos mensajes de
 * siempre, sólo empaquetados en el contrato genérico: el uploader también sirve
 * para la foto de una sede, con otras reglas (`venueImageRules`).
 */
export const DOCUMENT_UPLOADER_RULES: UploaderRules = {
  accept: DOCUMENT_ACCEPT_ATTRIBUTE,
  cameraAccept: 'image/jpeg,image/png',
  formatsHint: DOCUMENT_FORMATS_HINT,
  validate: (file) => {
    const result = validateDocumentFile(file);
    return result.ok
      ? { ok: true, preview: result.preview }
      : { ok: false, error: DOCUMENT_ERROR_MESSAGES[result.kind] };
  },
  describeError: (error) => DOCUMENT_ERROR_MESSAGES[classifyUploadError(error)],
  doneText: 'Subido. Queda pendiente de revisión.',
  announceDone: (title) => `${title} subido. Queda pendiente de revisión.`,
};

/**
 * La URL pre-firmada viene del backend: sólo se usa si es http(s).
 * Cualquier otra cosa (`javascript:`, `data:`) se descarta.
 */
export function safeDocumentUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

// -------------------------------------------------
// Estado de la carpeta de un participante
// -------------------------------------------------

/**
 * Documento vigente por tipo.
 *
 * Al reemplazar, el backend marca el anterior como RECHAZADO ("Reemplazado por
 * una versión más reciente") y crea uno nuevo, así que la carpeta acumula
 * historia. El vigente es el más reciente de cada tipo.
 */
export function currentDocumentsByType(
  documents: readonly DocumentEntity[],
): Map<DocumentType, DocumentEntity> {
  const current = new Map<DocumentType, DocumentEntity>();
  for (const doc of documents) {
    const previous = current.get(doc.documentType);
    if (!previous || doc.createdAt > previous.createdAt) current.set(doc.documentType, doc);
  }
  return current;
}

/**
 * Papeles protagonistas que faltan: nunca se subieron o el vigente fue
 * rechazado (hay que mandar otro).
 */
export function missingFeaturedTypes(documents: readonly DocumentEntity[]): DocumentType[] {
  const current = currentDocumentsByType(documents);
  return FEATURED_DOCUMENT_TYPES.filter((type) => {
    const doc = current.get(type);
    return !doc || doc.status === DocumentStatus.RECHAZADO;
  });
}

/** Cantidades reales de los documentos vigentes, por estado. */
export function countByStatus(documents: readonly DocumentEntity[]): Record<DocumentStatus, number> {
  const counts: Record<DocumentStatus, number> = {
    [DocumentStatus.PENDIENTE]: 0,
    [DocumentStatus.APROBADO]: 0,
    [DocumentStatus.RECHAZADO]: 0,
  };
  for (const doc of currentDocumentsByType(documents).values()) counts[doc.status] += 1;
  return counts;
}

/** "Faltan DNI (frente) y Ficha médica." — `null` si no falta nada. */
export function describeMissing(types: readonly DocumentType[]): string | null {
  if (types.length === 0) return null;
  const labels = types.map((type) => DOCUMENT_TYPE_LABELS[type]);
  const last = labels.pop();
  const list = labels.length > 0 ? `${labels.join(', ')} y ${last}` : last;
  return `${types.length === 1 ? 'Falta' : 'Faltan'} ${list}.`;
}

/** Nota obligatoria al rechazar (el backend responde 400 sin ella). */
export const REJECTION_NOTE_MAX = 500;

export function validateRejectionNote(note: string): string | null {
  const clean = note.trim();
  if (clean.length === 0) return 'Contá por qué lo rechazás: el delegado lo va a leer para mandar otro.';
  if (clean.length > REJECTION_NOTE_MAX) return `Usá ${REJECTION_NOTE_MAX} caracteres como máximo.`;
  return null;
}

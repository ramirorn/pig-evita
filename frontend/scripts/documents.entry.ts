// Punto de entrada del chequeo de documentos (scripts/check-documents.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_FORMATS,
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_HINTS,
  FEATURED_DOCUMENT_TYPES,
  SECONDARY_DOCUMENT_TYPES,
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_ERROR_MESSAGES,
  documentErrorKindFromStatus,
  classifyUploadError,
  isCanceledUpload,
  validateDocumentFile,
  uploadPercent,
  safeDocumentUrl,
  currentDocumentsByType,
  missingFeaturedTypes,
  countByStatus,
  describeMissing,
  validateRejectionNote,
  isDocumentType,
} from '@/lib/documents/documentRules';
export { formatFileSize } from '@/lib/utils';
export { DocumentType, DocumentStatus } from '@/types';

// Punto de entrada del chequeo de la foto de sede (scripts/check-venues.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  MAX_VENUE_IMAGE_BYTES,
  ALLOWED_VENUE_IMAGE_FORMATS,
  VENUE_IMAGE_ACCEPT_ATTRIBUTE,
  VENUE_IMAGE_FORMATS_HINT,
  VENUE_IMAGE_ERROR_MESSAGES,
  VENUE_IMAGE_UPLOADER_RULES,
  VENUE_IMAGE_OPTIMIZE_MAX_SIDE,
  VENUE_IMAGE_OPTIMIZE_MAX_BYTES,
  VENUE_IMAGE_TARGET_SIDE,
  VENUE_IMAGE_QUALITY,
  venueImageErrorKindFromStatus,
  classifyVenueImageError,
  validateVenueImageFile,
  needsVenueImageOptimization,
  scaledVenueImageSize,
  renameWithExtension,
  pickSmallerFile,
  resolveVenueImageUrl,
  pickVenueImageSrc,
  venueImageAlt,
} from '@/lib/venues/venueImageRules';
export {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_UPLOADER_RULES,
  validateDocumentFile,
} from '@/lib/documents/documentRules';

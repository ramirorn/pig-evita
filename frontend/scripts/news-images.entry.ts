// Punto de entrada del chequeo de la imagen de noticia (scripts/check-news-images.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_FORMATS,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_FORMATS_HINT,
  validateImageFile,
  resolveApiImageUrl,
} from '@/lib/images/imageRules';
export {
  NEWS_IMAGE_ERROR_MESSAGES,
  NEWS_IMAGE_UPLOADER_RULES,
  resolveNewsImageUrl,
  newsImageSrc,
  isValidExternalImageUrl,
  imageKeyForPayload,
  newsImageAlt,
} from '@/lib/news/newsImageRules';
export {
  VENUE_IMAGE_ERROR_MESSAGES,
  VENUE_IMAGE_UPLOADER_RULES,
  MAX_VENUE_IMAGE_BYTES,
  ALLOWED_VENUE_IMAGE_FORMATS,
} from '@/lib/venues/venueImageRules';
export { SafeNewsImage } from '@/pages/public/news/SafeNewsImage';

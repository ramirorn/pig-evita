// ===========================================
// Reducción de la foto de sede en el navegador (canvas, sin dependencias)
// ===========================================
//
// Una foto de teléfono pesa 4-8 MB y mide 4000 px de lado; la portada de una
// tarjeta se ve a 400-600 px. Antes de subirla se reduce a ~1600 px y se
// re-codifica (WebP si el navegador sabe, si no JPEG 0,85). Las decisiones
// (cuándo, a qué tamaño, con qué nombre, si conviene) están en
// `venueImageRules` y las prueba `check:venues`; acá queda sólo lo que
// necesita DOM.
//
// Nunca empeora las cosas: ante cualquier falla (navegador viejo, formato que
// no decodifica, canvas sin memoria) o si el resultado no es más chico,
// devuelve el archivo original y el backend decide.
import {
  VENUE_IMAGE_QUALITY,
  needsVenueImageOptimization,
  pickSmallerFile,
  renameWithExtension,
  scaledVenueImageSize,
  venueImageMimeOf,
} from './venueImageRules';

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

export async function optimizeVenueImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  // Si no dice ser una imagen aceptada, que la validación lo explique.
  if (!venueImageMimeOf(file)) return file;

  let bitmap: ImageBitmap;
  try {
    // `from-image` aplica la orientación EXIF: la foto sacada "de costado"
    // queda derecha también en el archivo reducido (que ya no lleva EXIF).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    if (!needsVenueImageOptimization({ size: file.size, width: bitmap.width, height: bitmap.height })) {
      return file;
    }

    const { width, height } = scaledVenueImageSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    // Fondo blanco: un PNG con transparencia re-codificado a JPEG quedaría negro.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    // Un navegador sin encoder WebP devuelve PNG en silencio: se chequea el tipo.
    const webp = await canvasToBlob(canvas, 'image/webp', VENUE_IMAGE_QUALITY);
    const blob =
      webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg', VENUE_IMAGE_QUALITY);
    if (!blob || (blob.type !== 'image/webp' && blob.type !== 'image/jpeg')) return file;

    const extension = blob.type === 'image/webp' ? '.webp' : '.jpg';
    const optimized = new File([blob], renameWithExtension(file.name, extension), {
      type: blob.type,
      lastModified: file.lastModified,
    });
    return pickSmallerFile(file, optimized);
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

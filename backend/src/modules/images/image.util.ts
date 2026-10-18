// ===========================================
// Imágenes subidas (sedes, noticias) — helpers compartidos
// ===========================================
//
// La clave del objeto en MinIO NO sale nunca de la API: las respuestas publican
// una `imageUrl` relativa a la API (`/api/v1/<recurso>/<id>/image?v=<versión>`)
// y el GET correspondiente hace stream desde el bucket, que sigue privado. No
// hay URLs firmadas: se vencen y romperían el caché de la página pública.
import { createHash } from 'node:crypto';
import type { Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { MinioService } from '../documents/minio.service';
import { TIPOS_IMAGEN } from './image-signature.pipe';

/** Tamaño máximo de una imagen subida (lo aplica multer mientras lee el stream). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Mismo valor que `app.apiPrefix` (config/index.ts). Se lee del entorno y no
 * del `ConfigService` para que armar una respuesta siga siendo una función
 * pura, sin dependencias que inyectar.
 */
const API_PREFIX = (process.env.API_PREFIX || 'api/v1').replace(
  /^\/+|\/+$/g,
  '',
);

/**
 * Versión de la imagen para la URL: cambia con cada reemplazo porque la clave
 * lleva un UUID nuevo. Es un hash para no filtrar la clave interna.
 */
export function versionDeImagen(imageKey: string): string {
  return createHash('sha256').update(imageKey).digest('hex').slice(0, 12);
}

/** `/api/v1/<recurso>/<id>/image?v=<versión>`. */
export function rutaDeImagen(
  recurso: string,
  id: string,
  imageKey: string,
): string {
  return `/${API_PREFIX}/${recurso}/${id}/image?v=${versionDeImagen(imageKey)}`;
}

/**
 * Content-Type a servir según la extensión de la clave. La clave la arma el
 * backend con la extensión canónica del tipo DETECTADO por firma, así que la
 * extensión es confiable; lo que no sea una imagen conocida no se sirve.
 */
export function contentTypeDeClave(imageKey: string): string | null {
  const extension = imageKey.slice(imageKey.lastIndexOf('.')).toLowerCase();
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return TIPOS_IMAGEN.jpeg;
    case '.png':
      return TIPOS_IMAGEN.png;
    case '.webp':
      return TIPOS_IMAGEN.webp;
    default:
      return null;
  }
}

/** La URL lleva `?v=<versión>`: el contenido de una URL no cambia nunca. */
export const CACHE_IMAGEN_INMUTABLE = 'public, max-age=31536000, immutable';
/** Imagen de algo no publicado (borrador): ni cachés compartidos ni disco. */
export const CACHE_IMAGEN_PRIVADA = 'private, no-store';

/**
 * Escribe la imagen en la respuesta con los headers de un archivo estático.
 *
 * Los headers se ponen acá, después del `CacheControlInterceptor` (que a un
 * request con sesión le pone `no-store`): la imagen pública es la misma para
 * todo el mundo y se cachea igual.
 */
export async function enviarImagen(
  res: Response,
  imagen: { stream: Readable; contentType: string },
  cacheControl: string = CACHE_IMAGEN_INMUTABLE,
): Promise<void> {
  res.setHeader('Content-Type', imagen.contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');

  try {
    await pipeline(imagen.stream, res);
  } catch {
    // Headers ya enviados: no hay respuesta de error posible. `pipeline`
    // destruye el socket, y el cliente ve una respuesta truncada.
  }
}

/**
 * Borra un objeto sin propagar el error: la base ya quedó consistente y un
 * objeto huérfano en el bucket no justifica fallar el pedido. Queda en log.
 */
export async function borrarObjetoSinFallar(
  minio: Pick<MinioService, 'deleteFile'>,
  clave: string,
  logger: Pick<Logger, 'warn'>,
): Promise<void> {
  try {
    await minio.deleteFile(clave);
  } catch (error) {
    logger.warn(
      `No se pudo borrar el objeto ${clave} de MinIO: ${(error as Error).message}`,
    );
  }
}

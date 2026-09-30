// ===========================================
// Subida de la foto de sede: multer con límite de tamaño
// ===========================================
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { VENUE_IMAGE_MAX_BYTES } from './venue-image.util';

export const MSG_FOTO_DEMASIADO_GRANDE =
  'La imagen supera el tamaño máximo de 5 MB';

/**
 * `FileInterceptor('file')` con los límites puestos en **multer**, no en un
 * `ParseFilePipe` posterior: busboy corta el stream apenas se pasa de 5 MB, así
 * que un archivo de 2 GB nunca llega a juntarse entero en memoria.
 */
const MulterFotoSede = FileInterceptor('file', {
  limits: {
    // +1 porque busboy corta al ALCANZAR el límite, no al pasarlo: con el
    // valor exacto, una foto de 5 MB justos se rechazaría.
    fileSize: VENUE_IMAGE_MAX_BYTES + 1,
    files: 1,
    fields: 5,
    fieldSize: 1024,
    parts: 6,
  },
});

/**
 * Envuelve el interceptor de multer para que el exceso de tamaño responda
 * **422**, igual que la subida de documentos (Nest lo traduciría a 413).
 * Cualquier otro error de multer (campo inesperado, demasiadas partes) sigue
 * siendo el 400 que arma Nest.
 */
@Injectable()
export class VenueImageUploadInterceptor implements NestInterceptor {
  private readonly multer: NestInterceptor = new MulterFotoSede();

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    try {
      return await (this.multer.intercept(context, next) as Promise<
        Observable<unknown>
      >);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new UnprocessableEntityException(MSG_FOTO_DEMASIADO_GRANDE);
      }
      throw error;
    }
  }
}

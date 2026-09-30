// ===========================================
// Venue Images Service — foto principal de cada sede
// ===========================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Readable } from 'node:stream';
import { PrismaService } from '../../database/prisma.service';
import { MinioService } from '../documents/minio.service';
import {
  EXTENSION_CANONICA_IMAGEN,
  detectarTipoDeImagen,
} from './image-signature.pipe';
import {
  VENUE_IMAGE_FOLDER,
  contentTypeDeClave,
  toVenueResponse,
} from './venue-image.util';

export const MSG_SEDE_NO_ENCONTRADA = 'Sede no encontrada';
export const MSG_SEDE_SIN_FOTO = 'La sede no tiene foto';
export const MSG_FOTO_EN_CONFLICTO =
  'La foto de la sede cambió mientras se procesaba el pedido. Volvé a intentarlo.';

@Injectable()
export class VenueImagesService {
  private readonly logger = new Logger(VenueImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  /**
   * Sube la foto y la deja como la foto de la sede, reemplazando la anterior.
   *
   * Orden: subir el objeto nuevo → apuntar la sede al objeto nuevo → borrar el
   * viejo. Así la sede nunca apunta a un objeto que no existe. El cambio de
   * clave es condicional (`imageKey` sigue siendo el que se leyó): si dos
   * subidas se cruzan, la segunda no pisa a la primera dejando un objeto
   * huérfano, sino que responde 409 y borra lo que subió.
   *
   * @param file ya validado por `ImageSignaturePipe` (tipo real y mimetype
   *             canónico) y acotado en tamaño por multer.
   */
  async upload(venueId: string, file: Express.Multer.File) {
    const anterior = await this.claveActual(venueId);

    const tipo = detectarTipoDeImagen(file.buffer);
    // El pipe ya lo garantizó; esto sólo protege contra un uso futuro sin pipe.
    if (!tipo) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a un JPEG, PNG o WebP',
      );
    }

    // El nombre que se le pasa a MinIO es fijo: el del usuario no se usa para
    // nada. `buildObjectName` le antepone un UUID y sanea carpeta y nombre,
    // así que la clave queda `venues/<venueId>/<uuid>-foto.<ext>`.
    const nuevaClave = await this.minio.uploadFile(
      file,
      `${VENUE_IMAGE_FOLDER}/${venueId}`,
      `foto${EXTENSION_CANONICA_IMAGEN[tipo]}`,
    );

    let actualizada: number;
    try {
      const { count } = await this.prisma.venue.updateMany({
        where: { id: venueId, imageKey: anterior },
        data: { imageKey: nuevaClave },
      });
      actualizada = count;
    } catch (error) {
      await this.borrarSinFallar(nuevaClave);
      throw error;
    }

    if (actualizada === 0) {
      await this.borrarSinFallar(nuevaClave);
      await this.claveActual(venueId); // 404 si la sede se borró en el medio
      throw new ConflictException(MSG_FOTO_EN_CONFLICTO);
    }

    if (anterior) {
      await this.borrarSinFallar(anterior);
    }

    this.logger.log(`Foto de la sede ${venueId} actualizada`);
    return this.venueActualizada(venueId);
  }

  /**
   * Quita la foto de la sede y borra el objeto. Idempotente: sobre una sede
   * sin foto devuelve la sede tal cual.
   */
  async remove(venueId: string) {
    const anterior = await this.claveActual(venueId);

    if (anterior) {
      const { count } = await this.prisma.venue.updateMany({
        where: { id: venueId, imageKey: anterior },
        data: { imageKey: null },
      });
      if (count === 0) {
        await this.claveActual(venueId);
        throw new ConflictException(MSG_FOTO_EN_CONFLICTO);
      }
      await this.borrarSinFallar(anterior);
      this.logger.log(`Foto de la sede ${venueId} eliminada`);
    }

    return this.venueActualizada(venueId);
  }

  /**
   * Stream de la foto para `GET /venues/:id/image`. 404 si la sede no existe,
   * si no tiene foto o si el objeto no está en el bucket.
   */
  async getImage(
    venueId: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    const clave = await this.claveActual(venueId);
    if (!clave) {
      throw new NotFoundException(MSG_SEDE_SIN_FOTO);
    }

    const contentType = contentTypeDeClave(clave);
    if (!contentType) {
      // Una clave que no termina en una extensión de imagen no la escribió
      // este service: no se sirve con un Content-Type inventado.
      this.logger.error(`Clave de foto inesperada en la sede ${venueId}`);
      throw new NotFoundException(MSG_SEDE_SIN_FOTO);
    }

    const stream = await this.minio.getObjectStream(clave);
    if (!stream) {
      this.logger.warn(
        `La sede ${venueId} apunta a una foto que no está en el bucket`,
      );
      throw new NotFoundException(MSG_SEDE_SIN_FOTO);
    }

    return { stream, contentType };
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------

  /** `imageKey` actual de la sede (o `null`); 404 si la sede no existe. */
  private async claveActual(venueId: string): Promise<string | null> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { imageKey: true },
    });
    if (!venue) {
      throw new NotFoundException(MSG_SEDE_NO_ENCONTRADA);
    }
    return venue.imageKey;
  }

  /** Misma forma que `GET /venues/:id` (con `_count`, sin `imageKey`). */
  private async venueActualizada(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      include: { _count: { select: { matches: true } } },
    });
    if (!venue) {
      throw new NotFoundException(MSG_SEDE_NO_ENCONTRADA);
    }
    return toVenueResponse(venue);
  }

  /**
   * Borra un objeto sin propagar el error: la base ya quedó consistente y un
   * objeto huérfano en el bucket no justifica fallar el pedido. Queda en log.
   */
  private async borrarSinFallar(clave: string): Promise<void> {
    try {
      await this.minio.deleteFile(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el objeto ${clave} de MinIO: ${(error as Error).message}`,
      );
    }
  }
}

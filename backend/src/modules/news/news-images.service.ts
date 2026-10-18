// ===========================================
// News Images Service — imagen SUBIDA de una noticia propia
// ===========================================
//
// Mismo esquema que la foto de sede (`venues/venue-images.service.ts`): subir
// el objeto nuevo → apuntar la noticia al objeto nuevo (condicional) → borrar
// el viejo. La diferencia es que acá la columna también puede tener una URL
// externa (ver `news-image.util.ts`): ésa no se borra de ningún lado, sólo se
// reemplaza.
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
} from '../images/image-signature.pipe';
import {
  borrarObjetoSinFallar,
  contentTypeDeClave,
} from '../images/image.util';
import {
  NEWS_IMAGE_FOLDER,
  esImagenSubida,
  toNewsResponse,
} from './news-image.util';
import { MSG_IMAGEN_EN_CONFLICTO, rechazarSiEsExterna } from './news.service';

export const MSG_NOTICIA_NO_ENCONTRADA = 'Noticia no encontrada';
export const MSG_NOTICIA_SIN_IMAGEN_SUBIDA =
  'La noticia no tiene una imagen subida';

@Injectable()
export class NewsImagesService {
  private readonly logger = new Logger(NewsImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  /**
   * Sube la imagen y la deja como la imagen de la noticia, reemplazando la
   * anterior (subida o URL). Una nota del portal se rechaza con 403 ANTES de
   * subir nada: su imagen es la del portal y el sync la volvería a pisar.
   *
   * @param file ya validado por `ImageSignaturePipe` (tipo real y mimetype
   *             canónico) y acotado en tamaño por multer.
   */
  async upload(newsId: string, file: Express.Multer.File) {
    const actual = await this.estadoActual(newsId);
    rechazarSiEsExterna(actual, 'cambiar su imagen');

    const tipo = detectarTipoDeImagen(file.buffer);
    // El pipe ya lo garantizó; esto sólo protege contra un uso futuro sin pipe.
    if (!tipo) {
      throw new BadRequestException(
        'El contenido del archivo no corresponde a un JPEG, PNG o WebP',
      );
    }

    // El nombre del usuario no se usa: `buildObjectName` antepone un UUID y la
    // clave queda `news/<newsId>/<uuid>-foto.<ext>`.
    const nuevaClave = await this.minio.uploadFile(
      file,
      `${NEWS_IMAGE_FOLDER}/${newsId}`,
      `foto${EXTENSION_CANONICA_IMAGEN[tipo]}`,
    );

    let actualizada: number;
    try {
      const { count } = await this.prisma.news.updateMany({
        where: { id: newsId, imageKey: actual.imageKey, isExternal: false },
        data: { imageKey: nuevaClave },
      });
      actualizada = count;
    } catch (error) {
      await this.borrarSinFallar(nuevaClave);
      throw error;
    }

    if (actualizada === 0) {
      await this.borrarSinFallar(nuevaClave);
      await this.estadoActual(newsId); // 404 si la noticia se borró en el medio
      throw new ConflictException(MSG_IMAGEN_EN_CONFLICTO);
    }

    if (esImagenSubida(actual.imageKey)) {
      await this.borrarSinFallar(actual.imageKey);
    }

    this.logger.log(`Imagen de la noticia ${newsId} actualizada`);
    return this.noticiaActualizada(newsId);
  }

  /**
   * Quita la imagen de la noticia, sea subida (se borra el objeto) o una URL
   * externa. Idempotente: sobre una noticia sin imagen la devuelve tal cual.
   */
  async remove(newsId: string) {
    const actual = await this.estadoActual(newsId);
    rechazarSiEsExterna(actual, 'quitar su imagen');

    if (actual.imageKey) {
      const { count } = await this.prisma.news.updateMany({
        where: { id: newsId, imageKey: actual.imageKey, isExternal: false },
        data: { imageKey: null },
      });
      if (count === 0) {
        await this.estadoActual(newsId);
        throw new ConflictException(MSG_IMAGEN_EN_CONFLICTO);
      }
      if (esImagenSubida(actual.imageKey)) {
        await this.borrarSinFallar(actual.imageKey);
      }
      this.logger.log(`Imagen de la noticia ${newsId} quitada`);
    }

    return this.noticiaActualizada(newsId);
  }

  /**
   * Stream de la imagen subida para `GET /news/:id/image`.
   *
   * Un borrador sólo se sirve a quien puede ver borradores (mismo criterio que
   * `GET /news/:id`); para el resto responde 404, sin confirmar que existe.
   * Una noticia con URL externa también da 404: esa imagen se pide afuera.
   */
  async getImage(
    newsId: string,
    verBorradores: boolean,
  ): Promise<{ stream: Readable; contentType: string; publicada: boolean }> {
    const news = await this.prisma.news.findFirst({
      where: verBorradores ? { id: newsId } : { id: newsId, isPublished: true },
      select: { imageKey: true, isPublished: true },
    });
    if (!news) {
      throw new NotFoundException(MSG_NOTICIA_NO_ENCONTRADA);
    }
    if (!esImagenSubida(news.imageKey)) {
      throw new NotFoundException(MSG_NOTICIA_SIN_IMAGEN_SUBIDA);
    }

    const contentType = contentTypeDeClave(news.imageKey);
    if (!contentType) {
      // Una clave que no termina en una extensión de imagen no la escribió
      // este service: no se sirve con un Content-Type inventado.
      this.logger.error(`Clave de imagen inesperada en la noticia ${newsId}`);
      throw new NotFoundException(MSG_NOTICIA_SIN_IMAGEN_SUBIDA);
    }

    const stream = await this.minio.getObjectStream(news.imageKey);
    if (!stream) {
      this.logger.warn(
        `La noticia ${newsId} apunta a una imagen que no está en el bucket`,
      );
      throw new NotFoundException(MSG_NOTICIA_SIN_IMAGEN_SUBIDA);
    }

    return { stream, contentType, publicada: news.isPublished };
  }

  // -------------------------------------------------
  // Helpers
  // -------------------------------------------------

  /** Lo justo para decidir: imagen actual y si es del portal. 404 si no existe. */
  private async estadoActual(newsId: string) {
    const news = await this.prisma.news.findUnique({
      where: { id: newsId },
      select: { imageKey: true, isExternal: true, sourceUrl: true },
    });
    if (!news) {
      throw new NotFoundException(MSG_NOTICIA_NO_ENCONTRADA);
    }
    return news;
  }

  /** Misma forma que `GET /news/:id` (sin `imageKey`, con `imageUrl`). */
  private async noticiaActualizada(newsId: string) {
    const news = await this.prisma.news.findUnique({ where: { id: newsId } });
    if (!news) {
      throw new NotFoundException(MSG_NOTICIA_NO_ENCONTRADA);
    }
    return toNewsResponse(news);
  }

  private borrarSinFallar(clave: string): Promise<void> {
    return borrarObjetoSinFallar(this.minio, clave, this.logger);
  }
}

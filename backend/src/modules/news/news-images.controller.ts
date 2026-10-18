// ===========================================
// News Images Controller — imagen subida de una noticia
// ===========================================
//
// Controller aparte del de noticias, como el de sedes: el CRUD de noticias no
// depende de MinIO para leer, y los specs que lo montan sin almacenamiento
// siguen andando igual.
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  Audit,
  CurrentUser,
  Public,
  PublicAssetThrottle,
  Roles,
} from '../../common/decorators';
import { ACCIONES, AuditAction } from '../../common/constants';
import { OptionalJwtAuthGuard } from '../../common/guards';
import { puedeVerBorradores } from '../../common/content-visibility';
import type { UsuarioConRol } from '../../common/content-visibility';
import { ImageSignaturePipe } from '../images/image-signature.pipe';
import { ImageUploadInterceptor } from '../images/image-upload.interceptor';
import {
  CACHE_IMAGEN_INMUTABLE,
  CACHE_IMAGEN_PRIVADA,
  enviarImagen,
} from '../images/image.util';
import { UploadNewsImageDto } from './dto';
import { NewsImagesService } from './news-images.service';

@ApiTags('News')
@Controller('news')
@ApiBearerAuth('access-token')
export class NewsImagesController {
  constructor(private readonly newsImages: NewsImagesService) {}

  @Post(':id/image')
  // Mismo permiso que editar la noticia (`PATCH /news/:id`).
  @Roles(...ACCIONES.NEWS_MANAGE)
  // Es un cambio de la noticia, no el alta de una: sin esto el interceptor de
  // auditoría lo registraría como CREATE sobre `news`.
  @Audit({ action: AuditAction.UPLOAD })
  @UseInterceptors(ImageUploadInterceptor)
  @ApiOperation({
    summary: 'Subir o reemplazar la imagen de la noticia',
    description:
      'Multipart con el campo `file`: JPG, PNG o WebP de hasta 5 MB, validado por la firma del contenido. ' +
      'Reemplaza la imagen anterior (subida o URL; si era subida, borra el objeto). ' +
      'Devuelve la noticia con `imageUrl`. Las notas del portal oficial no se tocan (403).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadNewsImageDto })
  @ApiResponse({
    status: 201,
    description: 'Noticia actualizada, con imageUrl',
  })
  @ApiResponse({
    status: 400,
    description:
      'Sin archivo, contenido que no es JPG/PNG/WebP o extensión que no coincide',
  })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({
    status: 403,
    description: 'Rol sin permiso NEWS_MANAGE, o nota sincronizada del portal',
  })
  @ApiResponse({ status: 404, description: 'Noticia no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Otra operación cambió la imagen al mismo tiempo',
  })
  @ApiResponse({ status: 422, description: 'La imagen supera los 5 MB' })
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ImageSignaturePipe) file: Express.Multer.File,
  ) {
    return this.newsImages.upload(id, file);
  }

  @Delete(':id/image')
  @Roles(...ACCIONES.NEWS_MANAGE)
  // Sin esto quedaría como DELETE sobre `news`: parecería que se borró la nota.
  @Audit({ action: AuditAction.UPDATE })
  @ApiOperation({
    summary: 'Quitar la imagen de la noticia',
    description:
      'Deja la noticia sin imagen (`imageUrl: null`); si era subida, borra el objeto. ' +
      'Idempotente. Las notas del portal oficial no se tocan (403).',
  })
  @ApiResponse({
    status: 200,
    description: 'Noticia actualizada, con imageUrl null',
  })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({
    status: 403,
    description: 'Rol sin permiso NEWS_MANAGE, o nota sincronizada del portal',
  })
  @ApiResponse({ status: 404, description: 'Noticia no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsImages.remove(id);
  }

  @Get(':id/image')
  @Public()
  // Un borrador se sirve sólo con sesión de quien puede verlo (como `GET /news/:id`).
  @UseGuards(OptionalJwtAuthGuard)
  @PublicAssetThrottle()
  @ApiOperation({
    summary: 'Imagen subida de la noticia (pública si está publicada)',
    description:
      'Stream de la imagen desde el almacenamiento privado. Usar la `imageUrl` de la noticia: ' +
      'lleva `?v=<versión>` y, si la noticia está publicada, se cachea un año (`immutable`). ' +
      'La imagen de un borrador sólo se sirve con sesión de un rol que ve borradores, y sin caché.',
  })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'Bytes de la imagen' })
  @ApiResponse({
    status: 404,
    description:
      'Noticia no encontrada, borrador sin sesión, o sin imagen subida (URL externa o ninguna)',
  })
  async getImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioConRol | null,
    @Res() res: Response,
  ): Promise<void> {
    const { publicada, ...imagen } = await this.newsImages.getImage(
      id,
      puedeVerBorradores(user),
    );
    await enviarImagen(
      res,
      imagen,
      publicada ? CACHE_IMAGEN_INMUTABLE : CACHE_IMAGEN_PRIVADA,
    );
  }
}

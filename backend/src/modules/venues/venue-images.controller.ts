// ===========================================
// Venue Images Controller — foto principal de la sede
// ===========================================
//
// Controller aparte del de sedes a propósito: el CRUD de sedes no depende de
// MinIO, y los specs que lo montan sin almacenamiento siguen andando igual.
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
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
import { pipeline } from 'node:stream/promises';
import {
  Audit,
  Public,
  PublicAssetThrottle,
  Roles,
} from '../../common/decorators';
import { ACCIONES, AuditAction } from '../../common/constants';
import { ImageSignaturePipe } from './image-signature.pipe';
import { UploadVenueImageDto } from './dto';
import { VenueImageUploadInterceptor } from './venue-image-upload.interceptor';
import { VenueImagesService } from './venue-images.service';

/** La URL lleva `?v=<versión>`: el contenido de una URL no cambia nunca. */
const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';

@ApiTags('Venues')
@Controller('venues')
@ApiBearerAuth('access-token')
export class VenueImagesController {
  constructor(private readonly venueImages: VenueImagesService) {}

  @Post(':id/image')
  @Roles(...ACCIONES.VENUE_MANAGE)
  // Para el negocio es un cambio de la sede, no el alta de una: sin esto el
  // interceptor lo registraría como CREATE sobre `venues`.
  @Audit({ action: AuditAction.UPLOAD })
  @UseInterceptors(VenueImageUploadInterceptor)
  @ApiOperation({
    summary: 'Subir o reemplazar la foto de la sede',
    description:
      'Multipart con el campo `file`: JPG, PNG o WebP de hasta 5 MB, validado por la firma del contenido. ' +
      'Reemplaza la foto anterior (y borra el objeto viejo). Devuelve la sede con `imageUrl`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadVenueImageDto })
  @ApiResponse({ status: 201, description: 'Sede actualizada, con imageUrl' })
  @ApiResponse({
    status: 400,
    description:
      'Sin archivo, contenido que no es JPG/PNG/WebP o extensión que no coincide',
  })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso VENUE_MANAGE' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Otra operación cambió la foto al mismo tiempo',
  })
  @ApiResponse({ status: 422, description: 'La imagen supera los 5 MB' })
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(ImageSignaturePipe) file: Express.Multer.File,
  ) {
    return this.venueImages.upload(id, file);
  }

  @Delete(':id/image')
  @Roles(...ACCIONES.VENUE_MANAGE)
  // Sin esto quedaría como DELETE sobre `venues`: parecería que se borró la sede.
  @Audit({ action: AuditAction.UPDATE })
  @ApiOperation({
    summary: 'Quitar la foto de la sede',
    description:
      'Borra el objeto de MinIO y deja la sede sin foto (`imageUrl: null`). ' +
      'Idempotente: sobre una sede sin foto responde 200 igual. Devuelve la sede actualizada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sede actualizada, con imageUrl null',
  })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso VENUE_MANAGE' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.venueImages.remove(id);
  }

  @Get(':id/image')
  @Public()
  @PublicAssetThrottle()
  @ApiOperation({
    summary: 'Foto de la sede (pública)',
    description:
      'Stream de la imagen desde el almacenamiento privado. Usar la `imageUrl` de la sede: ' +
      'lleva `?v=<versión>` y se cachea un año (`immutable`).',
  })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiResponse({ status: 200, description: 'Bytes de la imagen' })
  @ApiResponse({ status: 404, description: 'Sede no encontrada o sin foto' })
  async getImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, contentType } = await this.venueImages.getImage(id);

    // Se escriben después del `CacheControlInterceptor`, que a un request con
    // sesión le pone `no-store`: la foto es la misma para todo el mundo.
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', CACHE_INMUTABLE);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');

    try {
      await pipeline(stream, res);
    } catch {
      // Headers ya enviados: no hay respuesta de error posible. `pipeline`
      // destruye el socket, y el cliente ve una respuesta truncada.
    }
  }
}

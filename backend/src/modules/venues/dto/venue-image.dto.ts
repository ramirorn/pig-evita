import { ApiProperty } from '@nestjs/swagger';

/**
 * Sólo documentación de Swagger para `POST /venues/:id/image`: el archivo
 * llega por `@UploadedFile()`, no por `@Body()`, así que este DTO no se valida.
 */
export class UploadVenueImageDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Foto de la sede: JPG, PNG o WebP de hasta 5 MB. El tipo se valida por el contenido del archivo.',
  })
  file: unknown;
}

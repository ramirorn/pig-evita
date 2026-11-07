// ===========================================
// News DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateNewsDto {
  @ApiProperty({ description: 'Título de la noticia' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Contenido completo en HTML/Markdown' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Resumen corto' })
  @IsOptional()
  @IsString()
  excerpt?: string;

  /**
   * URL EXTERNA de la imagen (`https://…`). Para subir un archivo se usa
   * `POST /news/:id/image`, que guarda la clave de MinIO en esta misma columna
   * (ver `news-image.util.ts`). Por eso acá sólo entra una URL `https`: una
   * cadena como `news/<otro-id>/…` haría que el GET sirviera un objeto ajeno.
   *
   * `null` o `''` quitan la imagen (y, si era subida, se borra el objeto).
   */
  @ApiPropertyOptional({
    description:
      'URL https de una imagen externa. Para subir un archivo usá POST /news/:id/image. ' +
      'null o "" quita la imagen.',
    nullable: true,
    maxLength: 2048,
  })
  @IsOptional()
  @ValidateIf((_objeto, valor) => valor !== '')
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La imagen tiene que ser una URL que empiece con https://' },
  )
  imageKey?: string | null;

  @ApiPropertyOptional({ description: 'Publicar inmediatamente' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {}

/**
 * Sólo documentación de Swagger para `POST /news/:id/image`: el archivo llega
 * por `@UploadedFile()`, no por `@Body()`, así que este DTO no se valida.
 */
export class UploadNewsImageDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      'Imagen de la noticia: JPG, PNG o WebP de hasta 5 MB. El tipo se valida por el contenido del archivo.',
  })
  file: unknown;
}

export const CAMPOS_ORDEN_NEWS = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'title',
  'isPublished',
] as const;

export class NewsFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Solo publicadas' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPublished?: boolean;

  /**
   * Origen de la noticia: `true` las que vienen del portal oficial (S19),
   * `false` las propias de la plataforma.
   *
   * Es la **única** distinción real que existe entre noticias: el modelo no
   * tiene categorías temáticas. Cualquier filtro de "Oficial / Sedes /
   * Resultados" sería una etiqueta inventada sobre datos que no la respaldan.
   */
  @ApiPropertyOptional({
    description:
      'Filtrar por origen: true = del portal oficial, false = propias',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isExternal?: boolean;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  //
  // El default es la fecha de PUBLICACIÓN, no `createdAt`: para una nota del
  // portal, `createdAt` es cuándo la trajo el sync (ver `ordenDelListado`).
  @ApiPropertyOptional({
    description:
      'Campo para ordenar. Por defecto, fecha de publicación (más nueva primero).',
    enum: CAMPOS_ORDEN_NEWS,
    default: 'publishedAt',
  })
  @SortableBy(CAMPOS_ORDEN_NEWS)
  sortBy?: string = 'publishedAt';
}

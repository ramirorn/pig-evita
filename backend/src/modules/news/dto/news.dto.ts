// ===========================================
// News DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Clave o URL de imagen principal' })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ description: 'Publicar inmediatamente' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @ApiPropertyOptional({ description: 'Clave de imagen principal' })
  @IsOptional()
  @IsString()
  imageKey?: string;
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
    description: 'Filtrar por origen: true = del portal oficial, false = propias',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isExternal?: boolean;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_NEWS,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_NEWS)
  sortBy?: string = 'createdAt';
}

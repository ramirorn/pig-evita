// ===========================================
// News DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

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

  @ApiPropertyOptional({ description: 'Publicar inmediatamente' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {
  @ApiPropertyOptional({ description: 'Clave de imagen principal' })
  @IsOptional()
  @IsString()
  imageKey?: string;
}

export class NewsFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Solo publicadas' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

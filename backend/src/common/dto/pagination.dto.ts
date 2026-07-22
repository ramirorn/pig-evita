// ===========================================
// Base DTOs
// ===========================================
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO base para paginación.
 * Todos los endpoints de listado deben aceptar estos query params.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Número de página', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Campo para ordenar', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Dirección del orden', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Búsqueda general' })
  @IsOptional()
  @IsString()
  search?: string;

  /** Calcula el offset para Prisma skip */
  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 20);
  }

  /** Retorna el take para Prisma */
  get take(): number {
    return this.limit || 20;
  }
}

/**
 * Metadata de paginación para las respuestas.
 */
export class PaginationMeta {
  @ApiProperty({ description: 'Página actual' })
  page: number;

  @ApiProperty({ description: 'Elementos por página' })
  limit: number;

  @ApiProperty({ description: 'Total de elementos' })
  total: number;

  @ApiProperty({ description: 'Total de páginas' })
  totalPages: number;

  @ApiProperty({ description: 'Hay página anterior' })
  hasPrevious: boolean;

  @ApiProperty({ description: 'Hay página siguiente' })
  hasNext: boolean;
}

/**
 * Helper para construir respuestas paginadas.
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): { items: T[]; meta: PaginationMeta } {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

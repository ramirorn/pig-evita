// ===========================================
// Base DTOs
// ===========================================
import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO base para paginación.
 * Todos los endpoints de listado deben aceptar estos query params.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Tope duro: sin él, un `?limit=99999` obliga a Prisma a materializar el
  // listado entero y a serializarlo en un solo JSON — es un DoS de un request.
  // T28 proponía 200; se mantiene en 100 porque subir un límite que ya está
  // vigente y que ningún consumidor está pidiendo aflojar es regalar superficie
  // de ataque a cambio de nada (el frontend pagina de a 10/20).
  @Max(100)
  limit?: number = 20;

  // ⚠️ Sin whitelist. Cada DTO de filtro que realmente ordene tiene que
  // redeclarar este campo con `@SortableBy([...])` (ver R11 más abajo): el
  // valor viaja directo al `orderBy` de Prisma y una columna inexistente
  // termina en un 500 que filtra rutas del servidor y fragmentos de la query.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del orden',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'La dirección de orden debe ser "asc" o "desc"',
  })
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

// ===========================================
// Orden seguro (R11)
// ===========================================

/**
 * Declara la whitelist de columnas ordenables de un DTO de filtro.
 *
 * `orderBy: { [sortBy]: sortOrder }` mete el string del cliente adentro de la
 * consulta de Prisma. Con una columna inexistente Prisma tira un
 * `PrismaClientValidationError` cuyo mensaje trae la invocación entera —ruta
 * absoluta del archivo, número de línea y el fragmento de código— y el filtro
 * global lo devolvía como 500 en cualquier entorno que no sea producción.
 *
 * Con la whitelist eso pasa a ser un **400 de validación** antes de tocar la
 * base, que es además la respuesta correcta: el que se equivocó fue el cliente.
 *
 * Se redeclara la propiedad en la subclase; los validadores heredados
 * (`@IsOptional`, `@IsString`) siguen aplicando y este `@IsIn` se suma.
 */
export const SortableBy = (campos: readonly string[]) =>
  applyDecorators(
    IsOptional(),
    IsIn(campos as string[], {
      message: `El campo de orden debe ser uno de: ${campos.join(', ')}`,
    }),
  );

/**
 * Arma el `orderBy` de Prisma validando de nuevo contra la whitelist.
 *
 * Es defensa en profundidad a propósito: el DTO ya rechaza lo que no está en la
 * lista, pero un service puede recibir un filtro armado a mano desde otro
 * módulo (o alguien puede olvidarse de `@SortableBy` al agregar un DTO nuevo).
 * Acá el valor desconocido no explota: cae al campo por defecto.
 */
export function buildOrderBy<T extends string>(
  campos: readonly T[],
  porDefecto: T,
  sortBy?: string,
  sortOrder?: string,
): Record<string, 'asc' | 'desc'> {
  const campo = (campos as readonly string[]).includes(sortBy ?? '')
    ? (sortBy as T)
    : porDefecto;
  const direccion = sortOrder === 'asc' ? 'asc' : 'desc';
  return { [campo]: direccion };
}

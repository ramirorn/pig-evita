// ===========================================
// Venues DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateVenueDto {
  @ApiProperty({
    description: 'Nombre de la sede',
    example: 'Polideportivo Municipal',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({
    description: 'Dirección física',
    example: 'Av. San Martín 123',
  })
  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria' })
  address: string;

  @ApiProperty({ description: 'Localidad de la sede', example: 'Clorinda' })
  @IsString()
  @IsNotEmpty({ message: 'La localidad es obligatoria' })
  locality: string;

  @ApiProperty({ description: 'Departamento', example: 'Pilcomayo' })
  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio' })
  department: string;

  @ApiPropertyOptional({ description: 'Latitud geográfica' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitud geográfica' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Capacidad estimada de espectadores' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;
}

export class UpdateVenueDto extends PartialType(CreateVenueDto) {
  @ApiPropertyOptional({ description: 'Activo o inactivo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export const CAMPOS_ORDEN_VENUE = [
  'createdAt',
  'updatedAt',
  'name',
  'locality',
  'department',
  'capacity',
  'isActive',
] as const;

export class VenueFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por localidad' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_VENUE,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_VENUE)
  sortBy?: string = 'createdAt';
}

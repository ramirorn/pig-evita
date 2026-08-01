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
import { PaginationQueryDto } from '../../../common/dto';

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
  @IsBoolean()
  isActive?: boolean;
}

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
  @IsBoolean()
  isActive?: boolean;
}

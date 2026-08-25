// ===========================================
// Teams DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateTeamDto {
  @ApiProperty({ description: 'Nombre del equipo', example: 'Los Pumas' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({ description: 'ID de la categoría', example: 'uuid' })
  @IsUUID('4', { message: 'ID de categoría inválido' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  categoryId: string;

  @ApiPropertyOptional({
    description: 'Institución (club, escuela)',
    example: 'Escuela N° 1',
  })
  @IsOptional()
  @IsString()
  institution?: string;

  @ApiProperty({ description: 'Localidad', example: 'Clorinda' })
  @IsString()
  @IsNotEmpty({ message: 'La localidad es obligatoria' })
  locality: string;

  @ApiProperty({ description: 'Departamento', example: 'Pilcomayo' })
  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio' })
  department: string;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @ApiPropertyOptional({ description: 'Activo o inactivo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export const CAMPOS_ORDEN_TEAM = [
  'createdAt',
  'updatedAt',
  'name',
  'locality',
  'department',
  'isActive',
] as const;

export class TeamFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por disciplina' })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Filtrar por localidad' })
  @IsOptional()
  @IsString()
  locality?: string;

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
    enum: CAMPOS_ORDEN_TEAM,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_TEAM)
  sortBy?: string = 'createdAt';
}

export class AddTeamMemberDto {
  @ApiProperty({ description: 'ID del participante' })
  @IsUUID('4', { message: 'ID de participante inválido' })
  @IsNotEmpty({ message: 'El participante es obligatorio' })
  participantId: string;

  @ApiPropertyOptional({ description: 'Es capitán' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isCaptain?: boolean;

  @ApiPropertyOptional({ description: 'Número de camiseta' })
  @IsOptional()
  @IsString()
  shirtNumber?: string;
}

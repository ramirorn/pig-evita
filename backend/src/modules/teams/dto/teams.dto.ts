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
import { PaginationQueryDto } from '../../../common/dto';

export class CreateTeamDto {
  @ApiProperty({ description: 'Nombre del equipo', example: 'Los Pumas' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({ description: 'ID de la categoría', example: 'uuid' })
  @IsUUID('4', { message: 'ID de categoría inválido' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  categoryId: string;

  @ApiPropertyOptional({ description: 'Institución (club, escuela)', example: 'Escuela N° 1' })
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
  @IsBoolean()
  isActive?: boolean;
}

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

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddTeamMemberDto {
  @ApiProperty({ description: 'ID del participante' })
  @IsUUID('4', { message: 'ID de participante inválido' })
  @IsNotEmpty({ message: 'El participante es obligatorio' })
  participantId: string;

  @ApiPropertyOptional({ description: 'Es capitán' })
  @IsOptional()
  @IsBoolean()
  isCaptain?: boolean;

  @ApiPropertyOptional({ description: 'Número de camiseta' })
  @IsOptional()
  @IsString()
  shirtNumber?: string;
}

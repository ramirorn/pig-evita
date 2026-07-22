// ===========================================
// Categories DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Sex } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateCategoryDto {
  @ApiProperty({ description: 'ID de la disciplina', example: 'uuid' })
  @IsUUID('4', { message: 'ID de disciplina inválido' })
  @IsNotEmpty({ message: 'La disciplina es obligatoria' })
  disciplineId: string;

  @ApiProperty({ description: 'Nombre de la categoría', example: 'Sub-14' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({ description: 'Edad mínima', example: 12 })
  @IsInt()
  @Min(0)
  minAge: number;

  @ApiProperty({ description: 'Edad máxima', example: 14 })
  @IsInt()
  @Min(0)
  maxAge: number;

  @ApiProperty({ description: 'Sexo', enum: ['MASCULINO', 'FEMENINO', 'MIXTO'] })
  @IsEnum(Sex, { message: 'Sexo inválido' })
  sex: Sex;

  @ApiPropertyOptional({ description: 'Máximo de inscriptos/cupo total' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({ description: 'Cantidad máxima de miembros si es equipo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;
  @ApiPropertyOptional({ description: 'Activa o inactiva' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de disciplina' })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por sexo' })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

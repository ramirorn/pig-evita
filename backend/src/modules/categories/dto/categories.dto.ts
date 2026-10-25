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
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { AgeCriterion, Sex } from '@prisma/client';
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

  @ApiPropertyOptional({
    description:
      'Cómo se define el rango: por edad cumplida (AGE) o por año de nacimiento (BIRTH_YEAR)',
    enum: AgeCriterion,
    default: AgeCriterion.AGE,
  })
  @IsOptional()
  @IsEnum(AgeCriterion, { message: 'Criterio de edad inválido' })
  ageCriterion?: AgeCriterion;

  // Cada par es obligatorio sólo para su criterio; el servicio descarta el
  // del otro criterio. `null` se acepta para que el cliente pueda vaciarlo.
  @ApiPropertyOptional({
    description: 'Edad mínima (criterio AGE)',
    example: 12,
  })
  @ValidateIf((o: CreateCategoryDto) => o.minAge != null)
  @IsInt({ message: 'La edad mínima debe ser un número entero' })
  @Min(0)
  minAge?: number | null;

  @ApiPropertyOptional({
    description: 'Edad máxima (criterio AGE)',
    example: 14,
  })
  @ValidateIf((o: CreateCategoryDto) => o.maxAge != null)
  @IsInt({ message: 'La edad máxima debe ser un número entero' })
  @Min(0)
  maxAge?: number | null;

  @ApiPropertyOptional({
    description: 'Año de nacimiento más antiguo admitido (criterio BIRTH_YEAR)',
    example: 2010,
  })
  @ValidateIf((o: CreateCategoryDto) => o.minBirthYear != null)
  @IsInt({ message: 'El año de nacimiento debe ser un número entero' })
  @Min(1900)
  @Max(2100)
  minBirthYear?: number | null;

  @ApiPropertyOptional({
    description:
      'Año de nacimiento más reciente admitido (criterio BIRTH_YEAR)',
    example: 2012,
  })
  @ValidateIf((o: CreateCategoryDto) => o.maxBirthYear != null)
  @IsInt({ message: 'El año de nacimiento debe ser un número entero' })
  @Min(1900)
  @Max(2100)
  maxBirthYear?: number | null;

  @ApiProperty({
    description: 'Sexo',
    enum: ['MASCULINO', 'FEMENINO', 'MIXTO'],
  })
  @IsEnum(Sex, { message: 'Sexo inválido' })
  sex: Sex;

  @ApiPropertyOptional({ description: 'Máximo de inscriptos/cupo total' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de miembros si es equipo',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  teamSize?: number;
  @ApiPropertyOptional({ description: 'Activa o inactiva' })
  @IsOptional()
  @ToBoolean()
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
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

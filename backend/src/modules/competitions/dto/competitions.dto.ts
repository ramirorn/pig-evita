// ===========================================
// Competitions DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  CompetitionStage,
  CompetitionFormat,
  CompetitionStatus,
} from '@prisma/client';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateCompetitionDto {
  @ApiProperty({ description: 'ID de la disciplina' })
  @IsUUID('4')
  @IsNotEmpty()
  disciplineId: string;

  @ApiProperty({ description: 'ID de la categoría' })
  @IsUUID('4')
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Etapa', enum: CompetitionStage })
  @IsEnum(CompetitionStage)
  stage: CompetitionStage;

  @ApiProperty({ description: 'Formato', enum: CompetitionFormat })
  @IsEnum(CompetitionFormat)
  format: CompetitionFormat;

  @ApiPropertyOptional({
    description: 'Nombre opcional (ej: Final Provincial 2024)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? undefined
      : value?.trim(),
  )
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin' })
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Configuración JSON del motor (ej: puntos por victoria)',
  })
  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {
  @ApiPropertyOptional({ description: 'Estado', enum: CompetitionStatus })
  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;
}

export const CAMPOS_ORDEN_COMPETITION = [
  'createdAt',
  'updatedAt',
  'startDate',
  'endDate',
  'name',
  'stage',
  'status',
] as const;

export class CompetitionFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por disciplina' })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por etapa' })
  @IsOptional()
  @IsEnum(CompetitionStage)
  stage?: CompetitionStage;

  @ApiPropertyOptional({ description: 'Filtrar por estado' })
  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_COMPETITION,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_COMPETITION)
  sortBy?: string = 'createdAt';
}

// Generate Fixture DTO
export class GenerateFixtureDto {
  @ApiProperty({ description: 'ID de los equipos (si es deporte de equipo)' })
  @IsOptional()
  @IsUUID('4', { each: true })
  teamIds?: string[];

  @ApiProperty({
    description: 'ID de los participantes (si es deporte individual)',
  })
  @IsOptional()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

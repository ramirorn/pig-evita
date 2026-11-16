// ===========================================
// Métricas DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CompetitionStage,
  DisciplineType,
  Sex,
  SurveyWindow,
} from '@prisma/client';
import { ToBoolean } from '../../../common/transformers';

/**
 * Filtros comunes a todos los endpoints de métricas. Mismo contrato que
 * `SurveyMetricsQueryDto` (el panel viejo y el nuevo cortan igual).
 */
export class MetricsQueryDto {
  @ApiPropertyOptional({ enum: CompetitionStage })
  @IsOptional()
  @IsEnum(CompetitionStage)
  etapa?: CompetitionStage;

  @ApiPropertyOptional({ enum: SurveyWindow })
  @IsOptional()
  @IsEnum(SurveyWindow)
  ventana?: SurveyWindow;

  @ApiPropertyOptional({ description: 'Disciplina' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ enum: DisciplineType })
  @IsOptional()
  @IsEnum(DisciplineType)
  disciplineType?: DisciplineType;

  @ApiPropertyOptional({ description: 'Localidad' })
  @IsOptional()
  @IsUUID()
  localityId?: string;

  @ApiPropertyOptional({ description: 'Departamento de la localidad' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['CAPITAL', 'INTERIOR'] })
  @IsOptional()
  @IsIn(['CAPITAL', 'INTERIOR'])
  zona?: 'CAPITAL' | 'INTERIOR';

  @ApiPropertyOptional({ description: 'Categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sexo?: Sex;

  @ApiPropertyOptional({ description: 'Respuestas enviadas desde (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Respuestas enviadas hasta (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}

export class MetricsCrossQueryDto extends MetricsQueryDto {
  @ApiProperty({ description: 'Pregunta a desglosar (questionId)' })
  @IsUUID()
  pregunta: string;

  @ApiProperty({
    description:
      'Eje del cruce: etapa | ventana | sexo | disciplineType | disciplina | categoria | localidad | departamento | zona | pregunta:<questionId>',
    example: 'zona',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(etapa|ventana|sexo|disciplineType|disciplina|categoria|localidad|departamento|zona|pregunta:[0-9a-f-]{36})$/,
    { message: 'Dimensión de cruce inválida' },
  )
  por: string;
}

export class MetricsCatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Campaña a describir; si falta, la activa',
  })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

/** Definición declarativa de un KPI; la valida `validarDefinicionKpi`. */
export class CreateSurveyKpiDto {
  @ApiPropertyOptional({
    description: 'Campaña a la que pertenece; vacío = reutilizable para todas',
  })
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @ApiProperty({ example: 'Lesionados atendidos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({
    description:
      '{ numerador: [{ valores: string[] }], denominador: "todas" | "contestaron" | [{ valores }], formato: "porcentaje" | "conteo" }',
  })
  @IsObject()
  definicion: Record<string, unknown>;
}

export class UpdateSurveyKpiDto extends PartialType(CreateSurveyKpiDto) {}

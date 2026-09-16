// ===========================================
// Survey DTOs (S20)
// ===========================================
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CompetitionStage,
  DisciplineType,
  Sex,
  SurveyAudience,
  SurveyCampaignStatus,
  SurveyQuestionKind,
  SurveyWindow,
} from '@prisma/client';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';
import { ToBoolean } from '../../../common/transformers';

/** Slug de opción: snake_case, sin acentos. Es la clave de las métricas. */
const REGEX_VALOR_OPCION = /^[a-z0-9]+(_[a-z0-9]+)*$/;

// ===========================================
// Opciones
// ===========================================

export class CreateSurveyOptionDto {
  @ApiProperty({ description: 'Texto visible de la opción' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  texto: string;

  @ApiProperty({
    description:
      'Slug estable en snake_case (p. ej. `no_se_que_es`). NO cambiarlo al reescribir el texto: es la clave con la que se agregan las métricas.',
    example: 'no_se_que_es',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Matches(REGEX_VALOR_OPCION, {
    message:
      'El valor de la opción debe ser un slug en snake_case (letras minúsculas sin acentos, números y guiones bajos)',
  })
  valor: string;

  @ApiPropertyOptional({ description: 'Posición dentro de la pregunta' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;
}

export class UpdateSurveyOptionDto extends PartialType(CreateSurveyOptionDto) {}

// ===========================================
// Preguntas
// ===========================================

export class CreateSurveyQuestionDto {
  @ApiProperty({ description: 'Enunciado de la pregunta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  texto: string;

  @ApiPropertyOptional({ description: 'Aclaración debajo del enunciado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ayuda?: string;

  @ApiPropertyOptional({
    description: 'UNICA admite una opción; MULTIPLE, una o más',
    enum: SurveyQuestionKind,
    default: SurveyQuestionKind.UNICA,
  })
  @IsOptional()
  @IsEnum(SurveyQuestionKind)
  kind?: SurveyQuestionKind;

  @ApiPropertyOptional({
    description:
      'A quién se le muestra. INDIVIDUAL/EQUIPO se filtran contra el disciplineType de quien responde.',
    enum: SurveyAudience,
    default: SurveyAudience.TODOS,
  })
  @IsOptional()
  @IsEnum(SurveyAudience)
  audiencia?: SurveyAudience;

  @ApiPropertyOptional({ description: 'Debe responderse para poder enviar' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  obligatoria?: boolean;

  @ApiPropertyOptional({ description: 'Se muestra en el formulario' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ description: 'Posición dentro de la campaña' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  orden?: number;

  /**
   * Opciones creadas junto con la pregunta. Es el camino normal desde el panel:
   * una pregunta sin opciones no se puede contestar, así que pedir dos llamadas
   * para dejar el modelo consistente sería una invitación a dejarlo a medias.
   */
  @ApiPropertyOptional({
    description: 'Opciones a crear junto con la pregunta',
    type: [CreateSurveyOptionDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyOptionDto)
  opciones?: CreateSurveyOptionDto[];
}

/**
 * El alta acepta `opciones` anidadas; la edición no. Editar una opción es
 * `PATCH .../options/:optionId`: si `PATCH` de pregunta aceptara el arreglo
 * entero habría que decidir qué hacer con las que faltan, y "las borro" sobre
 * una campaña con respuestas cargadas destruye el desglose histórico.
 */
export class UpdateSurveyQuestionDto extends PartialType(
  OmitType(CreateSurveyQuestionDto, ['opciones'] as const),
) {}

// ===========================================
// Campañas
// ===========================================

export class CreateSurveyCampaignDto {
  @ApiProperty({ description: 'Título de la campaña' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @ApiPropertyOptional({ description: 'Descripción / consigna' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @ApiProperty({ description: 'Edición de los Juegos', example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio: number;

  @ApiProperty({
    description: 'Momento de la competencia',
    enum: SurveyWindow,
  })
  @IsEnum(SurveyWindow)
  ventana: SurveyWindow;

  @ApiPropertyOptional({
    description: 'Etapa a la que aplica. Vacío = todas.',
    enum: CompetitionStage,
  })
  @IsOptional()
  @IsEnum(CompetitionStage)
  etapa?: CompetitionStage;

  @ApiPropertyOptional({ description: 'Desde cuándo acepta respuestas (ISO)' })
  @IsOptional()
  @IsDateString()
  abreEn?: string;

  @ApiPropertyOptional({ description: 'Hasta cuándo acepta respuestas (ISO)' })
  @IsOptional()
  @IsDateString()
  cierraEn?: string;
}

/**
 * `status` no está: las transiciones van por `POST /:id/publish` y
 * `POST /:id/close`, que son las que validan (una campaña no se activa sin
 * preguntas, una cerrada no se reabre). Un `PATCH { status }` las salteaba.
 */
export class UpdateSurveyCampaignDto extends PartialType(
  CreateSurveyCampaignDto,
) {}

export const CAMPOS_ORDEN_SURVEY_CAMPAIGNS = [
  'createdAt',
  'updatedAt',
  'anio',
  'titulo',
  'status',
] as const;

export class SurveyCampaignFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Edición', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @ApiPropertyOptional({ enum: SurveyCampaignStatus })
  @IsOptional()
  @IsEnum(SurveyCampaignStatus)
  status?: SurveyCampaignStatus;

  @ApiPropertyOptional({ enum: SurveyWindow })
  @IsOptional()
  @IsEnum(SurveyWindow)
  ventana?: SurveyWindow;

  @ApiPropertyOptional({ enum: CompetitionStage })
  @IsOptional()
  @IsEnum(CompetitionStage)
  etapa?: CompetitionStage;

  // R11 — whitelist de orden, igual que el resto de los listados.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_SURVEY_CAMPAIGNS,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_SURVEY_CAMPAIGNS)
  sortBy?: string = 'createdAt';
}

// ===========================================
// Público
// ===========================================

export class ActiveSurveyQueryDto {
  @ApiPropertyOptional({
    description: 'Etapa en la que está compitiendo quien responde',
    enum: CompetitionStage,
  })
  @IsOptional()
  @IsEnum(CompetitionStage)
  etapa?: CompetitionStage;

  @ApiPropertyOptional({
    description: 'Momento de la competencia',
    enum: SurveyWindow,
  })
  @IsOptional()
  @IsEnum(SurveyWindow)
  ventana?: SurveyWindow;
}

export class SurveyAnswerInputDto {
  @ApiProperty({ description: 'Pregunta respondida' })
  @IsUUID()
  questionId: string;

  @ApiProperty({
    description:
      'Opciones elegidas. Exactamente una si la pregunta es UNICA; una o más si es MULTIPLE.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('4', { each: true })
  optionIds: string[];
}

/**
 * Envío anónimo.
 *
 * ⚠️ No hay —ni puede haber— `participantId`, `dni`, `email` ni nada que
 * identifique a quien responde. Los cortes que se piden (disciplina, localidad,
 * categoría, sexo) son demográficos gruesos y sirven para el análisis agregado;
 * la `ventana` no se acepta del cliente: se toma de la campaña, porque si no
 * cualquiera podría cargar respuestas "POST" mientras la campaña PRE está
 * abierta y ensuciar el análisis de flujo.
 */
export class SubmitSurveyResponseDto {
  @ApiProperty({ description: 'Campaña que se está respondiendo' })
  @IsUUID()
  campaignId: string;

  @ApiProperty({
    description: 'Etapa en la que compite quien responde',
    enum: CompetitionStage,
  })
  @IsEnum(CompetitionStage)
  etapa: CompetitionStage;

  @ApiProperty({
    description:
      'Tipo de disciplina de quien responde. Decide qué preguntas de audiencia INDIVIDUAL/EQUIPO son válidas.',
    enum: DisciplineType,
  })
  @IsEnum(DisciplineType)
  disciplineType: DisciplineType;

  @ApiPropertyOptional({ description: 'Disciplina' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Localidad' })
  @IsOptional()
  @IsUUID()
  localityId?: string;

  @ApiPropertyOptional({ description: 'Categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sexo?: Sex;

  @ApiProperty({
    description: 'Respuestas elegidas',
    type: [SurveyAnswerInputDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerInputDto)
  respuestas: SurveyAnswerInputDto[];
}

// ===========================================
// Métricas
// ===========================================

export class SurveyMetricsQueryDto {
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
}

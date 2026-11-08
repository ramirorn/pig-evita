// ===========================================
// Calendar DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { CompetitionStage } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateCalendarEventDto {
  @ApiProperty({ description: 'Título del evento' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción detallada' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Fecha de inicio (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (ISO 8601)' })
  @IsOptional()
  @ValidateIf(
    (o) => o.endDate !== '' && o.endDate !== null && o.endDate !== undefined,
  )
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Etapa de competencia asociada',
    enum: CompetitionStage,
  })
  @IsOptional()
  @ValidateIf(
    (o) => o.stage !== '' && o.stage !== null && o.stage !== undefined,
  )
  @IsEnum(CompetitionStage)
  stage?: CompetitionStage;

  @ApiPropertyOptional({ description: 'ID de la sede' })
  @IsOptional()
  @ValidateIf(
    (o) => o.venueId !== '' && o.venueId !== null && o.venueId !== undefined,
  )
  // F-24 — un id que no es UUID llegaba a Prisma y respondía 500 con el
  // detalle de la consulta. La existencia se verifica en el service.
  @IsUUID('all', { message: 'venueId debe ser un UUID válido' })
  venueId?: string;

  @ApiPropertyOptional({ description: 'ID de la disciplina' })
  @IsOptional()
  @ValidateIf(
    (o) =>
      o.disciplineId !== '' &&
      o.disciplineId !== null &&
      o.disciplineId !== undefined,
  )
  @IsUUID('all', { message: 'disciplineId debe ser un UUID válido' })
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Publicar inmediatamente' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCalendarEventDto extends PartialType(
  CreateCalendarEventDto,
) {}

export class CalendarFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar eventos desde (fecha)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filtrar eventos hasta (fecha)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Solo publicados' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isPublished?: boolean;
}

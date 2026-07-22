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
} from 'class-validator';
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
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Etapa de competencia asociada', enum: CompetitionStage })
  @IsOptional()
  @IsEnum(CompetitionStage)
  stage?: CompetitionStage;

  @ApiPropertyOptional({ description: 'ID de la sede' })
  @IsOptional()
  @IsUUID('4')
  venueId?: string;

  @ApiPropertyOptional({ description: 'ID de la disciplina' })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Publicar inmediatamente' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) {}

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
  @IsBoolean()
  isPublished?: boolean;
}

// ===========================================
// Disciplines DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DisciplineType, ResultType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateDisciplineDto {
  @ApiProperty({ description: 'Nombre de la disciplina', example: 'Fútbol 11' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @ApiProperty({ description: 'Tipo de disciplina', enum: DisciplineType })
  @IsEnum(DisciplineType, { message: 'Tipo inválido (INDIVIDUAL, EQUIPO)' })
  type: DisciplineType;

  @ApiProperty({ description: 'Tipo de resultado esperado', enum: ResultType })
  @IsEnum(ResultType)
  resultType: ResultType;

  @ApiPropertyOptional({ description: 'Reglamento (texto o enlace)' })
  @IsOptional()
  @IsString()
  rules?: string;

  @ApiPropertyOptional({ description: 'Mínimo de jugadores por equipo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @ApiPropertyOptional({ description: 'Máximo de jugadores por equipo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPlayers?: number;
  @ApiPropertyOptional({ description: 'Orden de visualización' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Activo o inactivo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDisciplineDto extends PartialType(CreateDisciplineDto) {}

export class DisciplineFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por tipo', enum: DisciplineType })
  @IsOptional()
  @IsEnum(DisciplineType)
  type?: DisciplineType;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

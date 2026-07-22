// ===========================================
// Results DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdateResultDto {
  @ApiPropertyOptional({ description: 'Datos del score en formato JSON', example: { goals: 3 } })
  @IsOptional()
  @IsObject()
  scoreData?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Posición final en el partido (para deportes de tiempo/marca)' })
  @IsOptional()
  @IsInt()
  ranking?: number;

  @ApiPropertyOptional({ description: 'Si es el ganador del encuentro' })
  @IsOptional()
  @IsBoolean()
  isWinner?: boolean;
}

export class MatchResultDto {
  @ApiProperty({ description: 'ID del resultado a actualizar' })
  @IsUUID('4')
  @IsNotEmpty()
  resultId: string;

  @ApiProperty({ description: 'Datos a actualizar' })
  @IsObject()
  @IsNotEmpty()
  data: UpdateResultDto;
}

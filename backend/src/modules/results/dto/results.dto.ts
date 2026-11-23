// ===========================================
// Results DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';

/** Claves que admite `scoreData` como máximo. */
export const MAXIMO_CLAVES_SCORE = 20;
/** Largo máximo de una clave o de un valor de texto de `scoreData`. */
export const MAXIMO_LARGO_SCORE = 50;

/**
 * `scoreData` es un `Json` libre cuya forma define la disciplina (`goles`,
 * `puntos`, `sets`, `tiempo`…), pero siempre es un objeto PLANO de pocas
 * claves con números, textos cortos o booleanos (VULN-24). Cualquier otra
 * cosa —objetos anidados, arrays, cientos de claves— no la produce ningún
 * cliente legítimo y se rechaza antes de llegar a la base.
 */
export function esScoreDataValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }
  const entradas = Object.entries(valor);
  if (entradas.length > MAXIMO_CLAVES_SCORE) return false;
  return entradas.every(
    ([clave, v]) =>
      clave.length <= MAXIMO_LARGO_SCORE &&
      ((typeof v === 'number' && Number.isFinite(v)) ||
        typeof v === 'boolean' ||
        (typeof v === 'string' && v.length <= MAXIMO_LARGO_SCORE)),
  );
}

export class UpdateResultDto {
  @ApiPropertyOptional({
    description: 'Datos del score en formato JSON',
    example: { goals: 3 },
  })
  @IsOptional()
  @IsObject()
  @ValidateBy({
    name: 'scoreDataPlano',
    validator: {
      validate: (valor: unknown) => esScoreDataValido(valor),
      defaultMessage: () =>
        `scoreData debe ser un objeto plano de hasta ${MAXIMO_CLAVES_SCORE} claves con números, textos de hasta ${MAXIMO_LARGO_SCORE} caracteres o booleanos`,
    },
  })
  scoreData?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    description: 'Posición final en el partido (para deportes de tiempo/marca)',
  })
  @IsOptional()
  @IsInt()
  ranking?: number;

  @ApiPropertyOptional({ description: 'Si es el ganador del encuentro' })
  @IsOptional()
  @ToBoolean()
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
  @ValidateNested()
  @Type(() => UpdateResultDto)
  data: UpdateResultDto;
}

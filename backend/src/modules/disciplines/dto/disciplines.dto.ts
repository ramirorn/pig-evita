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
import { ToBoolean } from '../../../common/transformers';
import { DisciplineType, ResultType } from '@prisma/client';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

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

  // S21 — composición del plantel que se carga en la inscripción por equipo.
  //
  // ⚠️ No son `minPlayers`/`maxPlayers` con otro nombre. Ese par es el
  // reglamento en la cancha ("con cuánta gente se puede competir"); este es la
  // planilla que el encargado tiene que completar al inscribir. En varias
  // disciplinas dan números distintos.
  //
  // La regla de "sólo en EQUIPO" NO se valida acá sino en el service: en un
  // `PATCH` el `type` puede no venir en el body y el tipo efectivo es el que
  // está en la base. Ver `DisciplinesService.validarPlantel()`.
  @ApiPropertyOptional({
    description:
      'Titulares que componen el plantel (sólo disciplinas de tipo EQUIPO)',
    example: 11,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad de titulares debe ser un número entero' })
  @Min(1, { message: 'La cantidad de titulares debe ser al menos 1' })
  titulares?: number;

  @ApiPropertyOptional({
    description:
      'Suplentes como máximo en el plantel (sólo disciplinas de tipo EQUIPO)',
    example: 5,
  })
  @IsOptional()
  @IsInt({ message: 'La cantidad de suplentes debe ser un número entero' })
  @Min(0, { message: 'La cantidad de suplentes no puede ser negativa' })
  maxSuplentes?: number;

  @ApiPropertyOptional({ description: 'Orden de visualización' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Activo o inactivo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDisciplineDto extends PartialType(CreateDisciplineDto) {}

/**
 * Contrato de respuesta de los endpoints de disciplinas.
 *
 * Existe para que `titulares` / `maxSuplentes` figuren en Swagger: el ABM los
 * carga y el formulario de inscripción por equipo los lee para saber cuántos
 * integrantes pedir. Sin esto, dos consumidores dependerían de campos que el
 * contrato publicado no menciona.
 *
 * El service devuelve la entidad de Prisma; esta clase describe esa forma, no
 * la recorta.
 */
export class DisciplineResponseDto {
  @ApiProperty({ description: 'ID de la disciplina' })
  id: string;

  @ApiProperty({ description: 'Nombre', example: 'Fútbol 11' })
  name: string;

  @ApiProperty({ enum: DisciplineType })
  type: DisciplineType;

  @ApiProperty({ enum: ResultType })
  resultType: ResultType;

  @ApiPropertyOptional({ description: 'Reglamento', nullable: true })
  rules: string | null;

  @ApiPropertyOptional({
    description: 'Mínimo de jugadores para poder competir',
    nullable: true,
  })
  minPlayers: number | null;

  @ApiPropertyOptional({
    description: 'Máximo de jugadores para poder competir',
    nullable: true,
  })
  maxPlayers: number | null;

  @ApiPropertyOptional({
    description:
      'Titulares del plantel de inscripción. `null` ⇒ la disciplina todavía no ' +
      'tiene el plantel configurado y no admite inscripción por equipo.',
    nullable: true,
    example: 11,
  })
  titulares: number | null;

  @ApiPropertyOptional({
    description: 'Suplentes como máximo en el plantel de inscripción',
    nullable: true,
    example: 5,
  })
  maxSuplentes: number | null;

  @ApiProperty({ description: 'Activa o inactiva' })
  isActive: boolean;

  @ApiProperty({ description: 'Orden de visualización' })
  sortOrder: number;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de última modificación' })
  updatedAt: Date;
}

export const CAMPOS_ORDEN_DISCIPLINE = [
  'createdAt',
  'updatedAt',
  'name',
  'sortOrder',
  'type',
  'isActive',
] as const;

export class DisciplineFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo',
    enum: DisciplineType,
  })
  @IsOptional()
  @IsEnum(DisciplineType)
  type?: DisciplineType;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_DISCIPLINE,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_DISCIPLINE)
  sortBy?: string = 'createdAt';
}

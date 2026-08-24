// ===========================================
// Audit Filter DTO (R03)
// ===========================================
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsISO8601,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';

/**
 * Filtros de `GET /audit`.
 *
 * Existe por una razón concreta: el handler tipaba el parámetro como
 * `PaginationQueryDto & { userId?: string; ... }`. TypeScript **no emite
 * metadata para un tipo intersección** —`design:paramtypes` queda en `Object`—,
 * así que el `ValidationPipe` no tenía clase que instanciar: no validaba, no
 * transformaba y no aplicaba defaults. `skip`/`take` llegaban `undefined` y
 * `?limit=99999` devolvía 200 con la tabla de auditoría entera, mientras el
 * mismo parámetro contra `/users` daba 400.
 *
 * Al heredar de `PaginationQueryDto` como **clase**, el tope de `@Max(100)`, el
 * default de 20 y los getters `skip`/`take` vuelven a aplicarse.
 */
export class AuditFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por usuario (uuid)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por acción (CREATE, UPDATE, DELETE, LOGIN, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por entidad (users, participants, inscriptions, …)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de entidad (uuid)' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  toDate?: string;
}

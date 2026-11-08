// ===========================================
// Documents DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DocumentType, DocumentStatus } from '@prisma/client';
import { Trim } from '../../../common/transformers';

export class UploadDocumentDto {
  @ApiProperty({ description: 'ID del participante' })
  @IsUUID('4')
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({ description: 'Tipo de documento', enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  /**
   * Sólo para que Swagger muestre el campo del formulario: el archivo llega por
   * `@UploadedFile()`, no por el body.
   *
   * El `@Allow()` no es decorativo. Con `target: ES2023` TypeScript emite los
   * campos de clase como propiedades reales (`useDefineForClassFields`), así que
   * el DTO instanciado tiene `file: undefined` aunque el body de multer no
   * traiga nada. Sin ningún decorador de class-validator, esa propiedad no está
   * en la whitelist y `forbidNonWhitelisted` respondía **400 "property file
   * should not exist" a toda subida**, incluso a la de un PDF impecable. Lo
   * descubrió el test de R14 al mandar el primer archivo legítimo.
   */
  @ApiProperty({
    description: 'Archivo binario',
    type: 'string',
    format: 'binary',
  })
  @Allow()
  file?: any;
}

export class ReviewDocumentDto {
  @ApiProperty({
    description: 'Nuevo estado del documento',
    enum: [DocumentStatus.APROBADO, DocumentStatus.RECHAZADO],
  })
  // F-08 — la revisión sólo decide: volver a PENDIENTE no es una revisión.
  @IsIn([DocumentStatus.APROBADO, DocumentStatus.RECHAZADO], {
    message: 'El estado de la revisión debe ser APROBADO o RECHAZADO',
  })
  status: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Observaciones (obligatorio si se rechaza)',
  })
  @IsOptional()
  // F-07 — se recorta para que "   " cuente como "sin observaciones".
  @Trim()
  @IsString()
  notes?: string;
}

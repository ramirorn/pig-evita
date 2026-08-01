// ===========================================
// Documents DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { DocumentType, DocumentStatus } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({ description: 'ID del participante' })
  @IsUUID('4')
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({ description: 'Tipo de documento', enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty({
    description: 'Archivo binario',
    type: 'string',
    format: 'binary',
  })
  file: any;
}

export class ReviewDocumentDto {
  @ApiProperty({
    description: 'Nuevo estado del documento',
    enum: [DocumentStatus.APROBADO, DocumentStatus.RECHAZADO],
  })
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Observaciones (obligatorio si se rechaza)',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

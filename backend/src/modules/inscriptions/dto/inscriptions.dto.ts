// ===========================================
// Inscriptions DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { Sex } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

/**
 * DTO público para inscripción via QR.
 * Incluye datos del participante + categoría elegida.
 */
export class CreateInscriptionDto {
  // --- Datos del participante ---
  @ApiProperty({ description: 'DNI', example: '12345678' })
  @IsString()
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni: string;

  @ApiProperty({ description: 'Nombre', example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName: string;

  @ApiProperty({ description: 'Apellido', example: 'Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName: string;

  @ApiProperty({ description: 'Fecha de nacimiento', example: '2010-05-15' })
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  birthDate: string;

  @ApiProperty({ description: 'Sexo', enum: ['MASCULINO', 'FEMENINO'] })
  @IsEnum(Sex, { message: 'Sexo inválido' })
  sex: Sex;

  @ApiPropertyOptional({ description: 'Teléfono' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email?: string;

  @ApiProperty({ description: 'Localidad', example: 'Formosa' })
  @IsString()
  @IsNotEmpty({ message: 'La localidad es obligatoria' })
  locality: string;

  @ApiProperty({ description: 'Departamento', example: 'Formosa' })
  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio' })
  department: string;

  @ApiPropertyOptional({ description: 'Dirección' })
  @IsOptional()
  @IsString()
  address?: string;

  // --- Datos de la inscripción ---
  @ApiProperty({ description: 'ID de la categoría a la que se inscribe' })
  @IsUUID('4', { message: 'ID de categoría inválido' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  categoryId: string;

  @ApiPropertyOptional({ description: 'ID del equipo (para deportes de equipo)' })
  @IsOptional()
  @IsUUID('4', { message: 'ID de equipo inválido' })
  teamId?: string;
}

export class ReviewInscriptionDto {
  @ApiProperty({ description: 'Nota de revisión' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectInscriptionDto {
  @ApiProperty({ description: 'Motivo del rechazo' })
  @IsString()
  @IsNotEmpty({ message: 'Debe indicar el motivo del rechazo' })
  rejectionNote: string;
}

export class InscriptionFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado', enum: ['PENDIENTE', 'REVISADA', 'APROBADA', 'RECHAZADA'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;
}

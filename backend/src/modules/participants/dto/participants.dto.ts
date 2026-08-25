// ===========================================
// Participants DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Sex } from '@prisma/client';
import { IsDni } from '../../../common/validators';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateParticipantDto {
  @ApiProperty({ description: 'DNI del participante', example: '12345678' })
  @IsDni()
  dni: string;

  @ApiProperty({ description: 'Nombre', example: 'Juan' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName: string;

  @ApiProperty({ description: 'Apellido', example: 'Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName: string;

  @ApiProperty({
    description: 'Fecha de nacimiento (ISO)',
    example: '2010-05-15',
  })
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  birthDate: string;

  @ApiProperty({ description: 'Sexo', enum: ['MASCULINO', 'FEMENINO'] })
  @IsEnum(Sex, {
    message: 'Sexo inválido. Valores permitidos: MASCULINO, FEMENINO',
  })
  sex: Sex;

  @ApiPropertyOptional({ description: 'Teléfono', example: '3704123456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email', example: 'juan@email.com' })
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
}

export class UpdateParticipantDto extends PartialType(CreateParticipantDto) {}

export const CAMPOS_ORDEN_PARTICIPANT = [
  'createdAt',
  'updatedAt',
  'lastName',
  'firstName',
  'birthDate',
  'dni',
  'locality',
  'department',
] as const;

export class ParticipantFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por DNI' })
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Filtrar por localidad' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por sexo',
    enum: ['MASCULINO', 'FEMENINO'],
  })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({ description: 'Filtrar por disciplina' })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_PARTICIPANT,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_PARTICIPANT)
  sortBy?: string = 'createdAt';
}

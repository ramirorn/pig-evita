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
  Matches,
} from 'class-validator';
import { Sex } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto';

export class CreateParticipantDto {
  @ApiProperty({ description: 'DNI del participante', example: '12345678' })
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
}

// ===========================================
// Inscriptions DTOs
// ===========================================
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InscriptionStatus, Sex } from '@prisma/client';
import { IsDni } from '../../../common/validators';
import { PaginationQueryDto } from '../../../common/dto';

/**
 * DTO público para inscripción via QR.
 * Incluye datos del participante + categoría elegida.
 */
export class CreateInscriptionDto {
  // --- Datos del participante ---
  @ApiProperty({ description: 'DNI', example: '12345678' })
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

  @ApiPropertyOptional({
    description: 'ID del equipo (para deportes de equipo)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID de equipo inválido' })
  teamId?: string;
}

// ===========================================
// S21 — inscripción de planteles completos
// ===========================================
//
// El alta individual (`CreateInscriptionDto`) va al revés que esto: primero la
// persona, después la categoría. Para un deporte de equipo eso obliga al
// encargado a cargar 16 chicos de a uno sin que el sistema sepa nunca que forman
// un plantel. Acá el orden se invierte: disciplina + categoría primero, y el
// plantel entero en un solo request.
//
// Identificadores en inglés como el resto del backend (AGENTS.md §3). Los
// únicos nombres en español son `titulares` / `maxSuplentes` en `Discipline`,
// que son del dominio y ya venían decididos.

/** Tope defensivo del plantel: ninguna disciplina real carga más que esto. */
export const MAX_INTEGRANTES_PLANTEL = 60;

export class CreateTeamMemberInscriptionDto {
  @ApiProperty({ description: 'DNI', example: '48123456' })
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

  @ApiProperty({ description: 'Localidad', example: 'Clorinda' })
  @IsString()
  @IsNotEmpty({ message: 'La localidad es obligatoria' })
  locality: string;

  @ApiProperty({ description: 'Departamento', example: 'Pilcomayo' })
  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio' })
  department: string;

  @ApiPropertyOptional({ description: 'Dirección' })
  @IsOptional()
  @IsString()
  address?: string;

  // --- Rol dentro del plantel ---

  /**
   * Titular o suplente. Obligatorio y sin default a propósito: si faltara y se
   * asumiera `false`, un plantel mandado sin la marca entraría como 16
   * titulares y el chequeo contra `discipline.titulares` lo rechazaría con un
   * mensaje que no explica nada. Que lo diga el cliente.
   */
  @ApiProperty({
    description: 'true ⇒ suplente; false ⇒ titular',
    example: false,
  })
  @IsBoolean({ message: 'Indicá si el integrante es suplente (true/false)' })
  isSubstitute: boolean;

  @ApiPropertyOptional({
    description: 'Posición en el equipo',
    example: 'Arquero',
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Número de camiseta', example: 10 })
  @IsOptional()
  @IsInt({ message: 'El número de camiseta debe ser un número entero' })
  @Min(0, { message: 'El número de camiseta no puede ser negativo' })
  @Max(999, { message: 'El número de camiseta no puede superar 999' })
  shirtNumber?: number;

  @ApiPropertyOptional({ description: 'Capitán del equipo', default: false })
  @IsOptional()
  @IsBoolean()
  isCaptain?: boolean;
}

export class CreateTeamInscriptionDto {
  @ApiProperty({ description: 'ID de la disciplina (debe ser de tipo EQUIPO)' })
  @IsUUID('4', { message: 'ID de disciplina inválido' })
  @IsNotEmpty({ message: 'La disciplina es obligatoria' })
  disciplineId: string;

  @ApiProperty({
    description: 'ID de la categoría, que debe pertenecer a la disciplina',
  })
  @IsUUID('4', { message: 'ID de categoría inválido' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  categoryId: string;

  @ApiProperty({ description: 'Nombre del equipo', example: 'Escuela 123' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del equipo es obligatorio' })
  teamName: string;

  @ApiProperty({ description: 'Localidad del equipo', example: 'Clorinda' })
  @IsString()
  @IsNotEmpty({ message: 'La localidad del equipo es obligatoria' })
  locality: string;

  @ApiProperty({ description: 'Departamento del equipo', example: 'Pilcomayo' })
  @IsString()
  @IsNotEmpty({ message: 'El departamento del equipo es obligatorio' })
  department: string;

  @ApiProperty({
    description:
      'Plantel completo: titulares y suplentes. La cantidad se valida contra ' +
      '`discipline.titulares` y `discipline.maxSuplentes`.',
    type: [CreateTeamMemberInscriptionDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'El plantel no puede estar vacío' })
  @ArrayMaxSize(MAX_INTEGRANTES_PLANTEL, {
    message: `El plantel no puede superar los ${MAX_INTEGRANTES_PLANTEL} integrantes`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateTeamMemberInscriptionDto)
  members: CreateTeamMemberInscriptionDto[];
}

// -------------------------------------------------
// Respuesta del alta de plantel
// -------------------------------------------------

/**
 * Disciplina en la respuesta del plantel: identidad + la composición contra la
 * que se validó, para que la UI pueda confirmar que cargó lo que correspondía.
 */
export class TeamInscriptionDisciplineDto {
  @ApiProperty() id: string;

  @ApiProperty() name: string;

  @ApiProperty({ description: 'Titulares exigidos' }) titulares: number;

  @ApiProperty({ description: 'Suplentes admitidos como máximo' })
  maxSuplentes: number;
}

export class TeamInscriptionCategoryDto {
  @ApiProperty() id: string;

  @ApiProperty() name: string;

  @ApiProperty() minAge: number;

  @ApiProperty() maxAge: number;

  @ApiProperty({ enum: ['MASCULINO', 'FEMENINO', 'MIXTO'] }) sex: Sex;
}

export class TeamInscriptionTeamDto {
  @ApiProperty() id: string;

  @ApiProperty() name: string;

  @ApiProperty() locality: string;

  @ApiProperty() department: string;
}

export class TeamInscriptionTotalsDto {
  @ApiProperty({ description: 'Titulares cargados' }) titulares: number;

  @ApiProperty({ description: 'Suplentes cargados' }) suplentes: number;

  @ApiProperty({ description: 'Integrantes del plantel' }) total: number;
}

/**
 * Un integrante ya inscripto: quién es, qué rol tiene en el plantel y el QR de
 * su trámite.
 *
 * Del participante viaja lo mismo que `PARTICIPANT_SUMMARY` (id, dni, nombre,
 * apellido) y nada más: esto es la respuesta de un alta, no una ficha. Quien
 * necesite los datos de contacto los pide por `GET /inscriptions/:id`.
 */
export class TeamInscriptionMemberDto {
  @ApiProperty() participantId: string;

  @ApiProperty() dni: string;

  @ApiProperty() firstName: string;

  @ApiProperty() lastName: string;

  @ApiProperty({ description: 'true ⇒ suplente' }) isSubstitute: boolean;

  @ApiProperty() isCaptain: boolean;

  @ApiPropertyOptional({ nullable: true }) position: string | null;

  @ApiPropertyOptional({ nullable: true }) shirtNumber: number | null;

  @ApiProperty({ description: 'ID de la inscripción creada' })
  inscriptionId: string;

  @ApiProperty({
    description: 'Código QR del trámite',
    example: 'EVITA-1A2B3C4D',
  })
  qrCode: string;

  @ApiProperty({
    description: 'Estado inicial del trámite',
    enum: ['PENDIENTE', 'REVISADA', 'APROBADA', 'RECHAZADA'],
  })
  status: InscriptionStatus;

  @ApiProperty({ description: 'QR renderizado como data URL PNG' })
  qrImage: string;
}

/** Contrato de la respuesta de `POST /inscriptions/team`. */
export class TeamInscriptionResultDto {
  @ApiProperty({ type: TeamInscriptionTeamDto })
  team: TeamInscriptionTeamDto;

  @ApiProperty({ type: TeamInscriptionDisciplineDto })
  discipline: TeamInscriptionDisciplineDto;

  @ApiProperty({ type: TeamInscriptionCategoryDto })
  category: TeamInscriptionCategoryDto;

  @ApiProperty({ type: TeamInscriptionTotalsDto })
  totals: TeamInscriptionTotalsDto;

  @ApiProperty({
    description: 'Un elemento por integrante, en el mismo orden del request',
    type: [TeamInscriptionMemberDto],
  })
  members: TeamInscriptionMemberDto[];
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
  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: ['PENDIENTE', 'REVISADA', 'APROBADA', 'RECHAZADA'],
  })
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

// ===========================================
// Respuesta pública (consulta por QR)
// ===========================================

/**
 * Datos mínimos del participante expuestos públicamente.
 * NUNCA debe incluir dni, email, phone, birthDate ni address.
 */
export class PublicInscriptionParticipantDto {
  @ApiProperty({ description: 'Nombre', example: 'Juan' })
  firstName: string;

  @ApiProperty({ description: 'Apellido', example: 'Pérez' })
  lastName: string;
}

export class PublicInscriptionDisciplineDto {
  @ApiProperty({ description: 'Nombre de la disciplina', example: 'Fútbol' })
  name: string;
}

export class PublicInscriptionCategoryDto {
  @ApiProperty({ description: 'Nombre de la categoría', example: 'Sub-14' })
  name: string;

  @ApiProperty({ type: PublicInscriptionDisciplineDto })
  discipline: PublicInscriptionDisciplineDto;
}

/**
 * Contrato de la respuesta del endpoint público `GET /inscriptions/qr/:qrCode`.
 * Superficie mínima: identificación del trámite + nombre + disciplina/categoría + estado.
 * Cualquier campo agregado acá queda expuesto a cualquier persona que conozca el código QR.
 */
export class PublicInscriptionDto {
  @ApiProperty({ description: 'Código QR de la inscripción' })
  qrCode: string;

  @ApiProperty({
    description: 'Estado del trámite',
    enum: ['PENDIENTE', 'REVISADA', 'APROBADA', 'RECHAZADA'],
  })
  status: InscriptionStatus;

  @ApiProperty({ description: 'Fecha de registro de la inscripción' })
  createdAt: Date;

  @ApiProperty({ type: PublicInscriptionParticipantDto })
  participant: PublicInscriptionParticipantDto;

  @ApiProperty({ type: PublicInscriptionCategoryDto })
  category: PublicInscriptionCategoryDto;
}

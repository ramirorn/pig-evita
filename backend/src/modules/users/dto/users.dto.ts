// ===========================================
// Users DTOs
// ===========================================
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { ToBoolean } from '../../../common/transformers';
import { Role } from '../../../common/constants';
import { PaginationQueryDto, SortableBy } from '../../../common/dto';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'coordinador@juegosevita.gob.ar',
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @ApiProperty({ description: 'Contraseña', minLength: 8 })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ description: 'Nombre' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  firstName: string;

  @ApiProperty({ description: 'Apellido' })
  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  lastName: string;

  @ApiProperty({ description: 'Rol del usuario', enum: Role })
  @IsEnum(Role, { message: 'Rol inválido' })
  role: Role;

  @ApiPropertyOptional({ description: 'Departamento asignado' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Zona asignada' })
  @IsOptional()
  @IsString()
  zone?: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ description: 'Nueva contraseña', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @ApiPropertyOptional({ description: 'Estado activo/inactivo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export const CAMPOS_ORDEN_USER = [
  'createdAt',
  'updatedAt',
  'lastName',
  'firstName',
  'email',
  'role',
  'isActive',
  'lastLoginAt',
] as const;

export class UserFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por rol', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;

  // R11 — whitelist de orden. Sin esto el string del cliente entra crudo al
  // `orderBy` de Prisma y una columna inexistente termina en un 500 con la
  // ruta del archivo y el fragmento de la consulta adentro del mensaje.
  @ApiPropertyOptional({
    description: 'Campo para ordenar',
    enum: CAMPOS_ORDEN_USER,
    default: 'createdAt',
  })
  @SortableBy(CAMPOS_ORDEN_USER)
  sortBy?: string = 'createdAt';
}

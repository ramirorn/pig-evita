// ===========================================
// Zones DTOs (R05)
// ===========================================
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReplaceZoneDepartmentsDto {
  @ApiProperty({
    description:
      'Departamentos que componen la zona. Tienen que existir en el catálogo `departments`.',
    example: ['Formosa', 'Laishi'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty({
    message: 'La zona tiene que tener al menos un departamento',
  })
  // Formosa tiene 9 departamentos: 32 es holgado y a la vez evita que alguien
  // mande un array gigante que se convierta en un `IN` de miles de elementos.
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  departments!: string[];
}

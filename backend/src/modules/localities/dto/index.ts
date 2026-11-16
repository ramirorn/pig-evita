// ===========================================
// Localities DTOs — respuesta del catálogo
// ===========================================
import { ApiProperty } from '@nestjs/swagger';

export class LocalityItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Pirané' }) name: string;
  @ApiProperty({ enum: ['CAPITAL', 'INTERIOR'] }) zona: 'CAPITAL' | 'INTERIOR';
}

export class DepartmentWithLocalitiesDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Pirané' }) name: string;
  @ApiProperty({ type: [LocalityItemDto] }) localities: LocalityItemDto[];
}

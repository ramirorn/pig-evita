// ===========================================
// Audit Controller
// ===========================================
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/constants';
import { AuditFilterDto } from './dto';

@ApiTags('Audit')
@Controller('audit')
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiOperation({
    summary: 'Consultar log de auditoría',
    description: 'Lista paginada de acciones registradas.',
  })
  @ApiResponse({ status: 200, description: 'Lista de logs de auditoría' })
  // El tipo tiene que ser una **clase**: con un tipo intersección TypeScript no
  // emite `design:paramtypes` utilizable y el ValidationPipe global se saltea
  // el DTO entero, incluido el `@Max(100)` de la paginación (R03).
  async findAll(@Query() query: AuditFilterDto) {
    return this.auditService.findAll(query);
  }
}

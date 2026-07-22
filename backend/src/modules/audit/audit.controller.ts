// ===========================================
// Audit Controller
// ===========================================
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/constants';
import { PaginationQueryDto } from '../../common/dto';

@ApiTags('Audit')
@Controller('audit')
@ApiBearerAuth('access-token')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
  @ApiOperation({ summary: 'Consultar log de auditoría', description: 'Lista paginada de acciones registradas.' })
  @ApiResponse({ status: 200, description: 'Lista de logs de auditoría' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filtrar por usuario' })
  @ApiQuery({ name: 'action', required: false, description: 'Filtrar por acción (CREATE, UPDATE, DELETE, LOGIN, etc.)' })
  @ApiQuery({ name: 'entity', required: false, description: 'Filtrar por entidad (users, participants, inscriptions, etc.)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filtrar por ID de entidad' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Fecha desde (ISO)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Fecha hasta (ISO)' })
  async findAll(
    @Query() query: PaginationQueryDto & {
      userId?: string;
      action?: string;
      entity?: string;
      entityId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    return this.auditService.findAll(query);
  }
}

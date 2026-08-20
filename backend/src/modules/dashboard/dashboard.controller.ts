// ===========================================
// Dashboard Controller
// ===========================================
import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardStatsDto } from './dto';
import { Roles } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(...ADMIN_ROLES, Role.COORDINADOR)
  @ApiOperation({
    summary: 'Obtener estadísticas globales del sistema (cacheadas 60s)',
    description:
      'Reemplaza las 8 consultas que hacía el dashboard (contadores, conteo por estado y últimas inscripciones) por un único request. El resultado es global — no varía por usuario ni por rol — y se cachea en Redis durante 60 segundos; si Redis no está disponible se calcula contra la base sin fallar.',
  })
  @ApiOkResponse({
    description: 'Estadísticas globales',
    type: DashboardStatsDto,
  })
  async getStats(): Promise<DashboardStatsDto> {
    return this.dashboardService.getGlobalStats();
  }
}

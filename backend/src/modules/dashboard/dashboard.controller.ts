// ===========================================
// Dashboard Controller
// ===========================================
import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(...ADMIN_ROLES, Role.COORDINADOR)
  @ApiOperation({ summary: 'Obtener estadísticas globales del sistema (cacheadas)' })
  @ApiResponse({ status: 200, description: 'Estadísticas globales' })
  async getStats() {
    return this.dashboardService.getGlobalStats();
  }
}

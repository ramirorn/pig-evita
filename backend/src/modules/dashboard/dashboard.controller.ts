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
import { Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly scope: ScopeService,
  ) {}

  @Get('stats')
  @Roles(...ACCIONES.DASHBOARD_READ)
  @ApiOperation({
    summary: 'Estadísticas del sistema recortadas al alcance del usuario',
    description:
      'Reemplaza las 8 consultas que hacía el dashboard (contadores, conteo por estado y últimas inscripciones) por un único request. ' +
      'El resultado **depende del alcance territorial** de quien pregunta (S02): un rol acotado ve los contadores de sus departamentos, ' +
      'y uno sin territorio cargado ve ceros. Se cachea en Redis 60 segundos bajo una clave derivada de ese alcance; ' +
      'si Redis no está disponible se calcula contra la base sin fallar.',
  })
  @ApiOkResponse({
    description: 'Estadísticas del alcance del usuario',
    type: DashboardStatsDto,
  })
  async getStats(@CurrentUser() actor: JwtPayload): Promise<DashboardStatsDto> {
    // El dashboard no era una excepción al recorte de R05: simplemente nunca
    // recibió al usuario. Sin este `alcanceDe`, el service no tiene contra qué
    // filtrar y devuelve la provincia entera a un delegado (S02).
    return this.dashboardService.getGlobalStats(
      await this.scope.alcanceDe(actor),
    );
  }
}

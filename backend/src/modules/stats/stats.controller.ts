// ===========================================
// Stats Controller — estadísticas públicas agregadas
// ===========================================
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { LocalitiesStatsDto } from './dto';
import {
  Public,
  PublicReadThrottle,
  CacheControl,
  CACHE_TTL,
} from '../../common/decorators';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('localities')
  @Public()
  @PublicReadThrottle()
  // Es igual para todo el mundo (no depende de quién pregunta), así que se
  // puede marcar cacheable por proxies sin riesgo de servir una vista ajena.
  @CacheControl(CACHE_TTL.STATS)
  @ApiOperation({
    summary: 'Participación agregada por localidad (mapa de calor)',
    description:
      'Endpoint público: devuelve **sólo conteos agregados**, sin ningún dato personal ni ids. ' +
      'Una entrada por localidad con participación; las que tienen todo en cero no aparecen.\n\n' +
      '- **Inscripción vigente**: toda la que no está RECHAZADA (PENDIENTE, REVISADA, APROBADA).\n' +
      '- **athletes**: participantes distintos con alguna inscripción vigente, por Participant.locality. Un integrante de equipo cuenta en su propia localidad.\n' +
      '- **delegations**: equipos activos con alguna inscripción vigente (por Team.locality) + una delegación por cada categoría con inscripciones individuales vigentes de la localidad.\n' +
      '- **disciplines / categories**: distintas, sumando las inscripciones de sus atletas y las de sus equipos.\n' +
      '- **podiums / wins**: resultados con ranking 1, 2, 3 y con isWinner, atribuidos por participant.locality (individuales) o team.locality (equipos).\n\n' +
      'Las variantes de un mismo nombre que difieren en mayúsculas, espacios o tildes se agrupan y se devuelve la grafía más usada. ' +
      'No se empareja contra el mapa: eso lo resuelve el frontend. ' +
      'Se cachea 60 segundos en Redis (y en el navegador/proxies); si Redis no está disponible se calcula contra la base sin fallar.',
  })
  @ApiOkResponse({
    description: 'Resumen de participación por localidad',
    type: LocalitiesStatsDto,
  })
  async getLocalities(): Promise<LocalitiesStatsDto> {
    return this.statsService.getLocalityStats();
  }
}

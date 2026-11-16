// ===========================================
// Localities Controller — catálogo público
// ===========================================
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CACHE_TTL,
  CacheControl,
  Public,
  PublicReadThrottle,
} from '../../common/decorators';
import { LocalitiesService } from './localities.service';
import { DepartmentWithLocalitiesDto } from './dto';

@ApiTags('Localities')
@Controller('localities')
export class LocalitiesController {
  constructor(private readonly localitiesService: LocalitiesService) {}

  @Get()
  @Public()
  @PublicReadThrottle()
  // Cambia una vez por temporada: cacheable sin riesgo, igual que los catálogos.
  @CacheControl(CACHE_TTL.CATALOG)
  @ApiOperation({
    summary: 'Departamentos y localidades de la provincia',
    description:
      'Endpoint público: devuelve el catálogo territorial completo, agrupado por departamento, ' +
      'con la zona (CAPITAL o INTERIOR) de cada localidad. Sin datos personales. ' +
      'Lo usa el formulario público de la encuesta para que la localidad sea un dato comparable.',
  })
  @ApiOkResponse({ type: [DepartmentWithLocalitiesDto] })
  findAll() {
    return this.localitiesService.findAll();
  }
}

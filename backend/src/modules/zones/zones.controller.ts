// ===========================================
// Zones Controller — mapeo zona → departamentos (R05)
// ===========================================
//
// La tabla es administrable desde la API y no sólo por seed: la composición de
// las zonas la decide la provincia y puede cambiar entre ediciones de los
// Juegos. Pedir un redeploy para eso garantizaría que el mapeo quede viejo.
import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { ReplaceZoneDepartmentsDto } from './dto';
import { Roles } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';

@ApiTags('Zones')
@Controller('zones')
@ApiBearerAuth('access-token')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @Roles(...ACCIONES.ZONE_READ)
  @ApiOperation({
    summary: 'Listar zonas con sus departamentos',
    description:
      'Si devuelve una lista vacía, ningún ADMIN_ZONAL ve datos: el mapeo ' +
      'todavía no se cargó.',
  })
  @ApiResponse({ status: 200, description: 'Zonas y sus departamentos' })
  async findAll() {
    return this.zonesService.findAll();
  }

  @Get(':zone')
  @Roles(...ACCIONES.ZONE_READ)
  @ApiOperation({ summary: 'Departamentos de una zona' })
  @ApiResponse({ status: 404, description: 'La zona no tiene mapeo cargado' })
  async findOne(@Param('zone') zone: string) {
    return this.zonesService.findOne(zone);
  }

  @Put(':zone')
  @Roles(...ACCIONES.ZONE_WRITE)
  @ApiOperation({
    summary: 'Definir los departamentos de una zona',
    description:
      'Reemplaza la composición completa de la zona. Los departamentos tienen ' +
      'que existir en el catálogo.',
  })
  @ApiResponse({ status: 200, description: 'Zona actualizada' })
  @ApiResponse({ status: 400, description: 'Departamento inexistente' })
  async replace(
    @Param('zone') zone: string,
    @Body() dto: ReplaceZoneDepartmentsDto,
  ) {
    return this.zonesService.replace(zone, dto.departments);
  }

  @Delete(':zone')
  @Roles(...ACCIONES.ZONE_WRITE)
  @ApiOperation({
    summary: 'Borrar el mapeo de una zona',
    description:
      'Los usuarios de esa zona dejan de ver datos hasta que se vuelva a cargar.',
  })
  async remove(@Param('zone') zone: string) {
    return this.zonesService.remove(zone);
  }
}

// ===========================================
// Metrics Controller — métricas de la encuesta
// ===========================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { MetricsService } from './metrics.service';
import {
  CreateSurveyHighlightDto,
  CreateSurveyKpiDto,
  MetricsCatalogQueryDto,
  MetricsCrossQueryDto,
  MetricsQueryDto,
  UpdateSurveyHighlightDto,
  UpdateSurveyKpiDto,
} from './dto';

@ApiTags('Metrics')
@Controller('metrics')
@ApiBearerAuth('access-token')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('catalog')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Catálogo para el constructor de gráficos',
    description:
      'Campañas, preguntas y opciones de la campaña elegida (o la activa), dimensiones de cruce, ' +
      'departamentos con sus localidades y zona, disciplinas y categorías. Sin datos personales.',
  })
  catalog(@Query() query: MetricsCatalogQueryDto) {
    return this.metricsService.catalog(query.campaignId);
  }

  @Get('survey/:id/version')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Versión de la campaña (sube con cada respuesta nueva)',
    description:
      'Lectura liviana para que el panel consulte cada pocos segundos si tiene que refrescar: ' +
      'cambia cuando entra una respuesta o se edita el cuestionario o un KPI.',
  })
  @ApiOkResponse({ schema: { example: { version: 128 } } })
  async version(@Param('id', ParseUUIDPipe) id: string) {
    return { version: await this.metricsService.version(id) };
  }

  @Get('survey/:id/overview')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary:
      'Resumen del corte: total, por etapa/ventana, por zona y serie temporal',
    description:
      'Todo pasa por el umbral de k-anonimato: un corte con menos respuestas que el umbral se devuelve suprimido, sin conteo.',
  })
  overview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MetricsQueryDto,
  ) {
    return this.metricsService.overview(id, query);
  }

  @Get('survey/:id/cross')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Tabla cruzada: una pregunta desglosada por una dimensión',
    description:
      '`pregunta` = questionId; `por` = etapa | ventana | sexo | disciplineType | disciplina | categoria | localidad | departamento | zona | pregunta:<questionId>. ' +
      'Celdas con menos respuestas que el umbral se suprimen, y con ellas el total de su fila.',
  })
  cross(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MetricsCrossQueryDto,
  ) {
    return this.metricsService.cross(id, query);
  }

  @Get('survey/:id/kpis')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Indicadores (KPIs) evaluados sobre el corte',
    description:
      'Evalúa los KPIs activos de la campaña y los reutilizables. El cociente se publica sólo cuando numerador y denominador superan el umbral.',
  })
  kpis(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MetricsQueryDto,
  ) {
    return this.metricsService.kpis(id, query);
  }

  @Get('survey/:id/highlights')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Destacados (rankings de opciones) evaluados sobre el corte',
    description:
      'Cada opción pasa por el umbral, por el complemento contra la base y, en opción única, por la supresión secundaria. Lo oculto no entra al ranking. `puedeAfirmar` indica si la base alcanza el mínimo para escribir frases.',
  })
  highlights(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MetricsQueryDto,
  ) {
    return this.metricsService.highlights(id, query);
  }

  // ===========================================
  // ABM de destacados (quien gestiona la encuesta)
  // ===========================================

  @Get('highlights')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Definiciones de destacados (de la campaña y reutilizables)',
  })
  listHighlights(@Query() query: MetricsCatalogQueryDto) {
    return this.metricsService.listHighlights(query.campaignId);
  }

  @Post('highlights')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Crear un destacado' })
  createHighlight(@Body() dto: CreateSurveyHighlightDto) {
    return this.metricsService.createHighlight(dto);
  }

  @Patch('highlights/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Editar un destacado' })
  updateHighlight(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurveyHighlightDto,
  ) {
    return this.metricsService.updateHighlight(id, dto);
  }

  @Delete('highlights/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Borrar un destacado' })
  removeHighlight(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricsService.removeHighlight(id);
  }

  // ===========================================
  // ABM de KPIs (quien gestiona la encuesta)
  // ===========================================

  @Get('kpis')
  @Roles(...ACCIONES.METRICS_READ)
  @ApiOperation({
    summary: 'Definiciones de KPI (de la campaña y reutilizables)',
  })
  listKpis(@Query() query: MetricsCatalogQueryDto) {
    return this.metricsService.listKpis(query.campaignId);
  }

  @Post('kpis')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Crear un KPI' })
  createKpi(@Body() dto: CreateSurveyKpiDto) {
    return this.metricsService.createKpi(dto);
  }

  @Patch('kpis/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Editar un KPI' })
  updateKpi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurveyKpiDto,
  ) {
    return this.metricsService.updateKpi(id, dto);
  }

  @Delete('kpis/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Borrar un KPI' })
  removeKpi(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricsService.removeKpi(id);
  }
}

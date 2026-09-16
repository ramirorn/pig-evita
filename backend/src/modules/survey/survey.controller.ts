// ===========================================
// Survey Controller (S20)
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SurveyService } from './survey.service';
import {
  ActiveSurveyQueryDto,
  CreateSurveyCampaignDto,
  CreateSurveyOptionDto,
  CreateSurveyQuestionDto,
  SubmitSurveyResponseDto,
  SurveyCampaignFilterDto,
  SurveyMetricsQueryDto,
  UpdateSurveyCampaignDto,
  UpdateSurveyOptionDto,
  UpdateSurveyQuestionDto,
} from './dto';
import {
  CACHE_TTL,
  CacheControl,
  CurrentUser,
  Public,
  PublicReadThrottle,
  Roles,
} from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { SURVEY_SUBMIT_RATE_LIMIT } from './survey.constants';

@ApiTags('Survey')
@Controller('survey')
@ApiBearerAuth('access-token')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  // ===========================================
  // Público
  // ===========================================

  /**
   * Cuestionario vigente. Sin token: lo contesta el chico desde su teléfono.
   *
   * Cacheable: la respuesta es idéntica para todo el mundo (no depende de quién
   * pregunta) y así el formulario abre aunque la conexión esté yendo y
   * viniendo, que es el problema que se está tratando de resolver.
   */
  @Get('active')
  @Public()
  @PublicReadThrottle()
  @CacheControl(CACHE_TTL.CONTENT)
  @ApiOperation({ summary: 'Encuesta activa para una etapa/ventana' })
  @ApiResponse({
    status: 200,
    description: 'Campaña activa con sus preguntas, o null si no hay ninguna',
  })
  async findActive(@Query() query: ActiveSurveyQueryDto) {
    return this.surveyService.findActive(query);
  }

  /**
   * Envío anónimo.
   *
   * Cupo propio y más estricto que el de lectura (ver
   * `SURVEY_SUBMIT_RATE_LIMIT`): cada request escribe una fila que después se
   * cuenta, y sin identidad no hay deduplicación posible. El rate limit es lo
   * único que impide inflar la muestra desde una pestaña.
   *
   * ⚠️ Este handler **no** recibe ni `@CurrentUser()` ni el request: no hay
   * nada de quien responde que deba llegar al service.
   */
  @Post('responses')
  @Public()
  @Throttle({ default: { ...SURVEY_SUBMIT_RATE_LIMIT } })
  @ApiOperation({ summary: 'Enviar una respuesta anónima' })
  @ApiResponse({ status: 201, description: 'Respuesta registrada' })
  @ApiResponse({
    status: 400,
    description: 'El envío no es consistente con el cuestionario',
  })
  async submitResponse(@Body() dto: SubmitSurveyResponseDto) {
    return this.surveyService.submitResponse(dto);
  }

  // ===========================================
  // Campañas (admin)
  // ===========================================

  @Get('campaigns')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Listar campañas de encuesta' })
  async findAllCampaigns(@Query() filterDto: SurveyCampaignFilterDto) {
    return this.surveyService.findAllCampaigns(filterDto);
  }

  @Post('campaigns')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Crear campaña de encuesta' })
  async createCampaign(
    @Body() dto: CreateSurveyCampaignDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.surveyService.createCampaign(dto, userId);
  }

  @Get('campaigns/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Obtener campaña con su cuestionario' })
  async findCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveyService.findCampaign(id);
  }

  @Patch('campaigns/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Actualizar campaña' })
  async updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurveyCampaignDto,
  ) {
    return this.surveyService.updateCampaign(id, dto);
  }

  @Delete('campaigns/:id')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Eliminar campaña (sólo si no tiene respuestas)' })
  async removeCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveyService.removeCampaign(id);
  }

  @Post('campaigns/:id/publish')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Publicar campaña (BORRADOR → ACTIVA)' })
  async publishCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveyService.publishCampaign(id);
  }

  @Post('campaigns/:id/close')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Cerrar campaña (ACTIVA → CERRADA)' })
  async closeCampaign(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveyService.closeCampaign(id);
  }

  // ===========================================
  // Preguntas y opciones (admin)
  // ===========================================

  @Post('campaigns/:id/questions')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Agregar pregunta (con sus opciones)' })
  async createQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSurveyQuestionDto,
  ) {
    return this.surveyService.createQuestion(id, dto);
  }

  @Patch('campaigns/:id/questions/:questionId')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Editar pregunta' })
  async updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateSurveyQuestionDto,
  ) {
    return this.surveyService.updateQuestion(id, questionId, dto);
  }

  @Delete('campaigns/:id/questions/:questionId')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Eliminar pregunta (sólo sin respuestas cargadas)' })
  async removeQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.surveyService.removeQuestion(id, questionId);
  }

  @Post('campaigns/:id/questions/:questionId/options')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Agregar opción a una pregunta' })
  async createOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: CreateSurveyOptionDto,
  ) {
    return this.surveyService.createOption(id, questionId, dto);
  }

  @Patch('campaigns/:id/questions/:questionId/options/:optionId')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Editar opción' })
  async updateOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() dto: UpdateSurveyOptionDto,
  ) {
    return this.surveyService.updateOption(id, questionId, optionId, dto);
  }

  @Delete('campaigns/:id/questions/:questionId/options/:optionId')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Eliminar opción (sólo si nadie la eligió)' })
  async removeOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
  ) {
    return this.surveyService.removeOption(id, questionId, optionId);
  }

  // ===========================================
  // Métricas (admin)
  // ===========================================

  /**
   * Agregados por pregunta y opción.
   *
   * Los cortes con menos de `UMBRAL_K_ANONIMATO` respuestas vuelven suprimidos:
   * responden menores de edad sobre su salud mental y un filtro fino sobre una
   * muestra chica alcanza para reidentificar a uno.
   */
  @Get('campaigns/:id/metrics')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({ summary: 'Métricas agregadas por pregunta y opción' })
  async getMetrics(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SurveyMetricsQueryDto,
  ) {
    return this.surveyService.getMetrics(id, query);
  }

  @Get('campaigns/:id/flow')
  @Roles(...ACCIONES.SURVEY_MANAGE)
  @ApiOperation({
    summary: 'Conteos por etapa/ventana, disciplina y localidad',
  })
  async getFlow(@Param('id', ParseUUIDPipe) id: string) {
    return this.surveyService.getFlow(id);
  }
}

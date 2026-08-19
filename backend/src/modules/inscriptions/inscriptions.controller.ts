// ===========================================
// Inscriptions Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InscriptionsService } from './inscriptions.service';
import {
  CreateInscriptionDto,
  ReviewInscriptionDto,
  RejectInscriptionDto,
  InscriptionFilterDto,
  PublicInscriptionDto,
} from './dto';
import {
  Public,
  Roles,
  CurrentUser,
  PublicReadThrottle,
} from '../../common/decorators';
import {
  INSCRIPTION_CREATORS,
  INSCRIPTION_REVIEWERS,
  INSCRIPTION_APPROVERS,
} from '../../common/constants';

@ApiTags('Inscriptions')
@Controller('inscriptions')
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  // --- Endpoint AUTENTICADO: inscripción por delegado ---
  @Post()
  @Roles(...INSCRIPTION_CREATORS)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Inscribir participante (delegado)',
    description:
      'Inscripción de participantes realizada por delegados autenticados. Registra quién creó la inscripción.',
  })
  @ApiResponse({
    status: 201,
    description: 'Inscripción creada exitosamente. Retorna datos + QR image.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o edad no compatible con categoría',
  })
  @ApiResponse({
    status: 409,
    description: 'Participante ya inscripto en esta categoría',
  })
  async create(
    @Body() createDto: CreateInscriptionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inscriptionsService.create(createDto, userId);
  }

  // --- Endpoint PÚBLICO: consulta por QR ---
  @Get('qr/:qrCode')
  @Public()
  @PublicReadThrottle()
  @ApiOperation({
    summary: 'Consultar inscripción por QR (público)',
    description:
      'Devuelve únicamente nombre y apellido del participante, disciplina, ' +
      'categoría y estado. No expone datos personales (DNI, email, teléfono, ' +
      'fecha de nacimiento, dirección).',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos públicos de la inscripción',
    type: PublicInscriptionDto,
  })
  @ApiResponse({ status: 404, description: 'Código QR no encontrado' })
  async findByQr(
    @Param('qrCode') qrCode: string,
  ): Promise<PublicInscriptionDto> {
    return this.inscriptionsService.findByQr(qrCode);
  }

  // --- Endpoints ADMINISTRATIVOS ---
  @Get()
  @Roles(...INSCRIPTION_REVIEWERS)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Listar inscripciones',
    description: 'Lista paginada con filtros.',
  })
  @ApiResponse({ status: 200, description: 'Lista de inscripciones' })
  async findAll(@Query() filterDto: InscriptionFilterDto) {
    return this.inscriptionsService.findAll(filterDto);
  }

  @Get(':id')
  @Roles(...INSCRIPTION_REVIEWERS)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Obtener inscripción',
    description: 'Incluye participante, documentos y equipo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos completos de la inscripción',
  })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscriptionsService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(...INSCRIPTION_REVIEWERS)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revisar inscripción',
    description: 'Cambia estado de PENDIENTE → REVISADA.',
  })
  @ApiResponse({ status: 200, description: 'Inscripción revisada' })
  @ApiResponse({ status: 400, description: 'Estado inválido para revisión' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Body() reviewDto: ReviewInscriptionDto,
  ) {
    return this.inscriptionsService.review(id, userId, reviewDto);
  }

  @Patch(':id/approve')
  @Roles(...INSCRIPTION_APPROVERS)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar inscripción',
    description: 'Cambia estado de REVISADA → APROBADA.',
  })
  @ApiResponse({ status: 200, description: 'Inscripción aprobada' })
  @ApiResponse({ status: 400, description: 'Estado inválido para aprobación' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inscriptionsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @Roles(...INSCRIPTION_REVIEWERS)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar inscripción',
    description: 'Rechaza con motivo obligatorio.',
  })
  @ApiResponse({ status: 200, description: 'Inscripción rechazada' })
  @ApiResponse({ status: 400, description: 'Estado inválido para rechazo' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Body() rejectDto: RejectInscriptionDto,
  ) {
    return this.inscriptionsService.reject(id, userId, rejectDto);
  }
}

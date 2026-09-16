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
  CreateTeamInscriptionDto,
  ReviewInscriptionDto,
  RejectInscriptionDto,
  InscriptionFilterDto,
  PublicInscriptionDto,
  TeamInscriptionResultDto,
} from './dto';
import {
  Public,
  Roles,
  CurrentUser,
  PublicReadThrottle,
  Audit,
} from '../../common/decorators';
import { ACCIONES, AuditAction } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('Inscriptions')
@Controller('inscriptions')
export class InscriptionsController {
  constructor(
    private readonly inscriptionsService: InscriptionsService,
    private readonly scope: ScopeService,
  ) {}

  // --- Endpoint AUTENTICADO: inscripción por delegado ---
  @Post()
  @Roles(...ACCIONES.INSCRIPTION_CREATE)
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
  @ApiResponse({
    status: 403,
    description: 'El departamento está fuera del alcance territorial (R05)',
  })
  async create(
    @Body() createDto: CreateInscriptionDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.inscriptionsService.create(
      createDto,
      userId,
      await this.scope.alcanceDe(actor),
    );
  }

  // --- Endpoint AUTENTICADO: inscripción de un plantel completo (S21) ---
  //
  // Mismos `@Roles(...)` que el alta individual: es el mismo acto de negocio
  // —inscribir gente— hecho de a un equipo en vez de de a una persona, y quien
  // puede lo uno puede lo otro. Una acción nueva en `ACCIONES` habría creado un
  // permiso que nadie sabría a quién asignar y que en la práctica se terminaría
  // dando a la misma lista.
  @Post('team')
  @Roles(...ACCIONES.INSCRIPTION_CREATE)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Inscribir un plantel completo (disciplinas de EQUIPO)',
    description:
      'Crea el equipo, sus integrantes (titulares y suplentes) y una inscripción ' +
      'por participante, todo en una sola transacción. Si falla cualquier ' +
      'integrante no se guarda nada. Los participantes se reutilizan por DNI. ' +
      'Sólo para disciplinas de tipo EQUIPO con `titulares` y `maxSuplentes` ' +
      'configurados; las INDIVIDUAL siguen por POST /inscriptions.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Plantel inscripto. Devuelve el equipo y un QR por integrante.',
    type: TeamInscriptionResultDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Disciplina INDIVIDUAL, plantel de la disciplina sin configurar, cantidad ' +
      'de titulares/suplentes incorrecta, categoría ajena a la disciplina, ' +
      'integrante fuera del rango de edad o sexo, DNI repetidos o más de un capitán',
  })
  @ApiResponse({
    status: 409,
    description:
      'Algún integrante ya está inscripto en esa categoría, o el nombre de ' +
      'equipo ya existe en esa disciplina y categoría',
  })
  @ApiResponse({
    status: 403,
    description:
      'El equipo o alguno de los integrantes está fuera del alcance territorial (R05)',
  })
  async createTeam(
    @Body() createDto: CreateTeamInscriptionDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<TeamInscriptionResultDto> {
    return this.inscriptionsService.createTeam(
      createDto,
      userId,
      await this.scope.alcanceDe(actor),
    );
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
  @Roles(...ACCIONES.INSCRIPTION_READ)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Listar inscripciones',
    description: 'Lista paginada con filtros.',
  })
  @ApiResponse({ status: 200, description: 'Lista de inscripciones' })
  async findAll(
    @Query() filterDto: InscriptionFilterDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.inscriptionsService.findAll(
      filterDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get(':id')
  @Roles(...ACCIONES.INSCRIPTION_READ)
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    // Fuera de alcance ⇒ 404, no 403.
    return this.inscriptionsService.findOne(
      id,
      await this.scope.alcanceDe(actor),
    );
  }

  @Patch(':id/review')
  // Para HTTP esto es un PATCH y el interceptor lo registraría como UPDATE,
  // que no distingue una revisión de cualquier otra edición. `@Audit` corrige
  // el nombre de la acción sin agregar una segunda fila: el evento de negocio
  // sigue saliendo por la misma vía. Ver el contrato en
  // `common/decorators/audit.decorator.ts`.
  @Audit({ action: AuditAction.REVIEW_INSCRIPTION })
  @Roles(...ACCIONES.INSCRIPTION_REVIEW)
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
    @CurrentUser() actor: JwtPayload,
    @Body() reviewDto: ReviewInscriptionDto,
  ) {
    return this.inscriptionsService.review(
      id,
      userId,
      reviewDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Patch(':id/approve')
  // Para HTTP esto es un PATCH y el interceptor lo registraría como UPDATE,
  // que no distingue una aprobación de cualquier otra edición. `@Audit` corrige
  // el nombre de la acción sin agregar una segunda fila: el evento de negocio
  // sigue saliendo por la misma vía. Ver el contrato en
  // `common/decorators/audit.decorator.ts`.
  @Audit({ action: AuditAction.APPROVE_INSCRIPTION })
  @Roles(...ACCIONES.INSCRIPTION_APPROVE)
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
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.inscriptionsService.approve(
      id,
      userId,
      await this.scope.alcanceDe(actor),
    );
  }

  @Patch(':id/reject')
  // Para HTTP esto es un PATCH y el interceptor lo registraría como UPDATE,
  // que no distingue una rechazo de cualquier otra edición. `@Audit` corrige
  // el nombre de la acción sin agregar una segunda fila: el evento de negocio
  // sigue saliendo por la misma vía. Ver el contrato en
  // `common/decorators/audit.decorator.ts`.
  @Audit({ action: AuditAction.REJECT_INSCRIPTION })
  @Roles(...ACCIONES.INSCRIPTION_REJECT)
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
    @CurrentUser() actor: JwtPayload,
    @Body() rejectDto: RejectInscriptionDto,
  ) {
    return this.inscriptionsService.reject(
      id,
      userId,
      rejectDto,
      await this.scope.alcanceDe(actor),
    );
  }
}

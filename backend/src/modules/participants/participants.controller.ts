// ===========================================
// Participants Controller
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ParticipantsService } from './participants.service';
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantFilterDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('Participants')
@Controller('participants')
@ApiBearerAuth('access-token')
export class ParticipantsController {
  constructor(
    private readonly participantsService: ParticipantsService,
    private readonly scope: ScopeService,
  ) {}

  @Post()
  @Roles(...ACCIONES.PARTICIPANT_CREATE)
  @ApiOperation({ summary: 'Crear participante' })
  @ApiResponse({ status: 201, description: 'Participante creado' })
  @ApiResponse({ status: 409, description: 'DNI ya registrado' })
  @ApiResponse({
    status: 403,
    description: 'El departamento está fuera del alcance territorial (R05)',
  })
  async create(
    @Body() createDto: CreateParticipantDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.participantsService.create(
      createDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get()
  @Roles(...ACCIONES.PARTICIPANT_READ)
  @ApiOperation({
    summary: 'Listar participantes',
    description: 'Lista paginada con filtros.',
  })
  @ApiResponse({ status: 200, description: 'Lista de participantes' })
  async findAll(
    @Query() filterDto: ParticipantFilterDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.participantsService.findAll(
      filterDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get('dni/:dni')
  @Roles(...ACCIONES.PARTICIPANT_READ)
  @ApiOperation({ summary: 'Buscar por DNI' })
  @ApiResponse({ status: 200, description: 'Datos del participante' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findByDni(@Param('dni') dni: string, @CurrentUser() actor: JwtPayload) {
    return this.participantsService.findByDni(
      dni,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get(':id')
  @Roles(...ACCIONES.PARTICIPANT_READ)
  @ApiOperation({
    summary: 'Obtener participante',
    description: 'Incluye inscripciones, documentos y equipos.',
  })
  @ApiResponse({ status: 200, description: 'Datos completos del participante' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    // Fuera de alcance ⇒ 404, no 403: ver `ParticipantsService.findOne`.
    return this.participantsService.findOne(
      id,
      await this.scope.alcanceDe(actor),
    );
  }

  @Patch(':id')
  @Roles(...ACCIONES.PARTICIPANT_UPDATE)
  @ApiOperation({ summary: 'Actualizar participante' })
  @ApiResponse({ status: 200, description: 'Participante actualizado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  @ApiResponse({ status: 409, description: 'DNI ya registrado' })
  @ApiResponse({
    status: 400,
    description: 'El rol no puede modificar el DNI (ver R17)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateParticipantDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    // El actor viaja hasta el service porque la regla no es "quién entra al
    // endpoint" (eso ya lo resuelve `@Roles`) sino "quién puede tocar este
    // campo". Ponerla en un guard obligaría a leer el body desde el guard.
    return this.participantsService.update(
      id,
      updateDto,
      await this.scope.alcanceDe(actor),
      actor,
    );
  }
}

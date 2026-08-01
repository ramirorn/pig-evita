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
import { Roles } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Participants')
@Controller('participants')
@ApiBearerAuth('access-token')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.ADMIN_ZONAL,
    Role.DELEGADO,
  )
  @ApiOperation({ summary: 'Crear participante' })
  @ApiResponse({ status: 201, description: 'Participante creado' })
  @ApiResponse({ status: 409, description: 'DNI ya registrado' })
  async create(@Body() createDto: CreateParticipantDto) {
    return this.participantsService.create(createDto);
  }

  @Get()
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({
    summary: 'Listar participantes',
    description: 'Lista paginada con filtros.',
  })
  @ApiResponse({ status: 200, description: 'Lista de participantes' })
  async findAll(@Query() filterDto: ParticipantFilterDto) {
    return this.participantsService.findAll(filterDto);
  }

  @Get('dni/:dni')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({ summary: 'Buscar por DNI' })
  @ApiResponse({ status: 200, description: 'Datos del participante' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findByDni(@Param('dni') dni: string) {
    return this.participantsService.findByDni(dni);
  }

  @Get(':id')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({
    summary: 'Obtener participante',
    description: 'Incluye inscripciones, documentos y equipos.',
  })
  @ApiResponse({ status: 200, description: 'Datos completos del participante' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.participantsService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN_PROVINCIAL,
    Role.ADMIN_DEPARTAMENTAL,
    Role.DELEGADO,
  )
  @ApiOperation({ summary: 'Actualizar participante' })
  @ApiResponse({ status: 200, description: 'Participante actualizado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  @ApiResponse({ status: 409, description: 'DNI ya registrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateParticipantDto,
  ) {
    return this.participantsService.update(id, updateDto);
  }
}

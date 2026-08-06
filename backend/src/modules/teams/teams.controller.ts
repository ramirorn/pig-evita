// ===========================================
// Teams Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { TeamsService } from './teams.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamFilterDto,
  AddTeamMemberDto,
} from './dto';
import { Roles } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Teams')
@Controller('teams')
@ApiBearerAuth('access-token')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({
    summary: 'Crear equipo',
    description: 'Crea un equipo para una disciplina de tipo EQUIPO.',
  })
  @ApiResponse({ status: 201, description: 'Equipo creado' })
  async create(@Body() createDto: CreateTeamDto) {
    return this.teamsService.create(createDto);
  }

  @Get()
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({ summary: 'Listar equipos' })
  @ApiResponse({ status: 200, description: 'Lista de equipos paginada' })
  async findAll(@Query() filterDto: TeamFilterDto) {
    return this.teamsService.findAll(filterDto);
  }

  @Get(':id')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({
    summary: 'Obtener equipo',
    description: 'Incluye a los miembros del equipo.',
  })
  @ApiResponse({ status: 200, description: 'Datos del equipo' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Actualizar equipo' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Eliminar equipo' })
  @ApiResponse({ status: 200, description: 'Equipo eliminado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.remove(id);
  }

  @Post(':id/members')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({ summary: 'Agregar participante al equipo' })
  @ApiResponse({ status: 201, description: 'Miembro agregado' })
  @ApiResponse({ status: 400, description: 'Equipo lleno' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addMemberDto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(id, addMemberDto);
  }

  @Delete(':id/members/:participantId')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover participante del equipo' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.teamsService.removeMember(id, participantId);
  }
}

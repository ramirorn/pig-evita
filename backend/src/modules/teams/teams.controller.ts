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
import { Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('Teams')
@Controller('teams')
@ApiBearerAuth('access-token')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly scope: ScopeService,
  ) {}

  @Post()
  @Roles(...ACCIONES.TEAM_CREATE)
  @ApiOperation({
    summary: 'Crear equipo',
    description: 'Crea un equipo para una disciplina de tipo EQUIPO.',
  })
  @ApiResponse({ status: 201, description: 'Equipo creado' })
  @ApiResponse({
    status: 403,
    description: 'El departamento está fuera del alcance territorial (R05)',
  })
  async create(
    @Body() createDto: CreateTeamDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.create(
      createDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get()
  @Roles(...ACCIONES.TEAM_READ)
  @ApiOperation({ summary: 'Listar equipos' })
  @ApiResponse({ status: 200, description: 'Lista de equipos paginada' })
  async findAll(
    @Query() filterDto: TeamFilterDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.findAll(
      filterDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get(':id')
  @Roles(...ACCIONES.TEAM_READ)
  @ApiOperation({
    summary: 'Obtener equipo',
    description: 'Incluye a los miembros del equipo.',
  })
  @ApiResponse({ status: 200, description: 'Datos del equipo' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    // Fuera de alcance ⇒ 404, no 403.
    return this.teamsService.findOne(id, await this.scope.alcanceDe(actor));
  }

  @Patch(':id')
  @Roles(...ACCIONES.TEAM_UPDATE)
  @ApiOperation({ summary: 'Actualizar equipo' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTeamDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.update(
      id,
      updateDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Delete(':id')
  @Roles(...ACCIONES.TEAM_DELETE)
  @ApiOperation({ summary: 'Eliminar equipo' })
  @ApiResponse({ status: 200, description: 'Equipo eliminado' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.remove(id, await this.scope.alcanceDe(actor));
  }

  @Post(':id/members')
  @Roles(...ACCIONES.TEAM_MEMBER_MANAGE)
  @ApiOperation({ summary: 'Agregar participante al equipo' })
  @ApiResponse({ status: 201, description: 'Miembro agregado' })
  @ApiResponse({ status: 400, description: 'Equipo lleno' })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addMemberDto: AddTeamMemberDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.addMember(
      id,
      addMemberDto,
      await this.scope.alcanceDe(actor),
    );
  }

  @Delete(':id/members/:participantId')
  @Roles(...ACCIONES.TEAM_MEMBER_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover participante del equipo' })
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.teamsService.removeMember(
      id,
      participantId,
      await this.scope.alcanceDe(actor),
    );
  }
}

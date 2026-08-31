// ===========================================
// Teams Service
// ===========================================
import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  TeamFilterDto,
  AddTeamMemberDto,
  CAMPOS_ORDEN_TEAM,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';
import {
  CATEGORY_WITH_DISCIPLINE,
  DISCIPLINE_SUMMARY,
  TEAM_MEMBER_WITH_PARTICIPANT,
} from '../../common/prisma-selects';
import { Alcance, ScopeService } from '../../common/scope';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async create(createDto: CreateTeamDto, alcance: Alcance) {
    // R05 — mismo criterio que en participantes: el alta se acota, y acá va
    // 403 porque el departamento viene en el body y no hay ninguna fila cuya
    // existencia se pueda deducir de la respuesta.
    if (!this.scope.permiteDepartamento(alcance, createDto.department)) {
      throw new ForbiddenException(
        `No podés crear equipos del departamento "${createDto.department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

    // 1. Verificar categoría y que sea de equipo
    const category = await this.prisma.category.findUnique({
      where: { id: createDto.categoryId },
      include: { discipline: true },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (category.discipline.type !== 'EQUIPO') {
      throw new BadRequestException(
        'Esta categoría no permite la creación de equipos (es INDIVIDUAL)',
      );
    }

    // 2. Crear equipo
    const team = await this.prisma.team.create({
      data: {
        ...createDto,
        disciplineId: category.discipline.id,
      },
      include: { category: { include: { discipline: true } } },
    });

    this.logger.log(`Team created: ${team.name} in category ${category.name}`);
    return team;
  }

  async findAll(filterDto: TeamFilterDto, alcance: Alcance) {
    const where: Prisma.TeamWhereInput = {};

    if (filterDto.disciplineId) {
      where.disciplineId = filterDto.disciplineId;
    }

    if (filterDto.categoryId) {
      where.categoryId = filterDto.categoryId;
    }

    if (filterDto.department) {
      where.department = {
        contains: filterDto.department,
        mode: 'insensitive',
      };
    }

    if (filterDto.locality) {
      where.locality = {
        contains: filterDto.locality,
        mode: 'insensitive',
      };
    }

    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto.search) {
      where.OR = [
        { name: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // R05 — filtro del cliente AND recorte territorial (ver ScopeService).
    const whereConAlcance = ScopeService.conAlcance(
      where,
      this.scope.whereTeam(alcance),
    );

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where: whereConAlcance,
        // La tabla muestra nombre, disciplina, categoría, zona y cantidad de
        // integrantes. La disciplina faltaba en la proyección anterior, así que
        // la columna "Disciplina" venía vacía; se agrega junto con el `select`.
        select: {
          id: true,
          name: true,
          locality: true,
          department: true,
          isActive: true,
          createdAt: true,
          discipline: { select: DISCIPLINE_SUMMARY },
          category: { select: CATEGORY_WITH_DISCIPLINE },
          _count: { select: { members: true } },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_TEAM,
          'createdAt',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.team.count({ where: whereConAlcance }),
    ]);

    return buildPaginatedResponse(teams, total, filterDto);
  }

  async findOne(id: string, alcance: Alcance) {
    const team = await this.prisma.team.findFirst({
      where: ScopeService.conAlcance({ id }, this.scope.whereTeam(alcance)),
      select: {
        id: true,
        name: true,
        locality: true,
        department: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        discipline: { select: DISCIPLINE_SUMMARY },
        category: { select: CATEGORY_WITH_DISCIPLINE },
        // El plantel muestra DNI, nombre, dorsal, posición y capitanía: no hace
        // falta el participante completo.
        members: { select: TEAM_MEMBER_WITH_PARTICIPANT },
        _count: { select: { members: true } },
      },
    });

    if (!team) {
      // 404 y no 403 para el equipo fuera de alcance: mismo mensaje que un id
      // inexistente, así la respuesta no confirma que el equipo existe.
      throw new NotFoundException('Equipo no encontrado');
    }

    return team;
  }

  async update(id: string, updateDto: UpdateTeamDto, alcance: Alcance) {
    const actual = await this.findOne(id, alcance); // verifica existencia y alcance

    // -------------------------------------------------
    // S03 — el departamento no es un campo más del PATCH
    // -------------------------------------------------
    //
    // El alta valida el departamento del body con `permiteDepartamento()`; la
    // edición no lo hacía, y `UpdateTeamDto` hereda `department` vía
    // `PartialType`. Un delegado podía abrir un equipo suyo y mudarlo al
    // departamento ajeno con un 200 — y quedar sin poder verlo después, porque
    // el `findOne` le devuelve 404 sobre la fila que acaba de mover.
    //
    // Sólo se corta si el valor **cambia**: los formularios mandan el objeto
    // completo, así que rechazar un PATCH que reenvía el mismo departamento
    // rompería la edición del resto de los campos.
    const cambiaDepartamento =
      updateDto.department !== undefined &&
      updateDto.department !== actual.department;

    if (
      cambiaDepartamento &&
      !this.scope.permiteDepartamento(alcance, updateDto.department)
    ) {
      throw new ForbiddenException(
        'No podés mover un equipo a un departamento fuera de tu alcance.',
      );
    }

    if (updateDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Categoría no encontrada');
      }
    }

    const team = await this.prisma.team.update({
      where: { id },
      data: updateDto,
      include: { category: true },
    });

    this.logger.log(`Team updated: ${team.name}`);
    return team;
  }

  async addMember(
    teamId: string,
    addMemberDto: AddTeamMemberDto,
    alcance: Alcance,
  ) {
    const team = await this.findOne(teamId, alcance);

    // 1. Validar tamaño máximo del equipo
    const currentMembers = team.members.length;
    const maxPlayers = team.category.discipline.maxPlayers;
    if (maxPlayers && currentMembers >= maxPlayers) {
      throw new BadRequestException(
        `El equipo alcanzó su límite máximo de ${maxPlayers} miembros`,
      );
    }

    // 2. Verificar que el participante existe **y está dentro del alcance**:
    // si no, sumar gente de otro departamento a un equipo propio sería la forma
    // más cómoda de leer un padrón ajeno (el plantel devuelve DNI y nombre).
    const participant = await this.prisma.participant.findFirst({
      where: ScopeService.conAlcance(
        { id: addMemberDto.participantId },
        this.scope.whereParticipant(alcance),
      ),
    });
    if (!participant) {
      throw new NotFoundException('Participante no encontrado');
    }

    // 3. Verificar que el participante no esté ya en el equipo
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        teamId_participantId: {
          teamId,
          participantId: addMemberDto.participantId,
        },
      },
    });
    if (existingMember) {
      throw new ConflictException('El participante ya pertenece a este equipo');
    }

    // 4. Si hay capitán, desactivar capitán anterior si este es el nuevo
    if (addMemberDto.isCaptain) {
      await this.prisma.teamMember.updateMany({
        where: { teamId, isCaptain: true },
        data: { isCaptain: false },
      });
    }

    // 5. Agregar miembro
    const member = await this.prisma.teamMember.create({
      data: {
        teamId,
        participantId: addMemberDto.participantId,
        isCaptain: addMemberDto.isCaptain || false,
        shirtNumber: addMemberDto.shirtNumber
          ? parseInt(addMemberDto.shirtNumber, 10)
          : null,
      },
      include: { participant: true },
    });

    this.logger.log(
      `Added participant ${participant.dni} to team ${team.name}`,
    );
    return member;
  }

  async removeMember(teamId: string, participantId: string, alcance: Alcance) {
    await this.findOne(teamId, alcance); // Verifica equipo y alcance

    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_participantId: { teamId, participantId },
      },
    });

    if (!member) {
      throw new NotFoundException('El participante no pertenece a este equipo');
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_participantId: { teamId, participantId },
      },
    });

    this.logger.log(`Removed participant ${participantId} from team ${teamId}`);
    return { message: 'Miembro removido exitosamente' };
  }

  async remove(id: string, alcance: Alcance) {
    const team = await this.findOne(id, alcance);

    const counts = await this.prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inscriptions: true,
            results: true,
          },
        },
      },
    });

    if (
      counts &&
      (counts._count.inscriptions > 0 || counts._count.results > 0)
    ) {
      this.logger.log(
        `Team ${team.name} has inscriptions/results, deactivating instead of permanent delete`,
      );
      return this.prisma.team.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await this.prisma.teamMember.deleteMany({
      where: { teamId: id },
    });

    const deleted = await this.prisma.team.delete({
      where: { id },
    });

    this.logger.log(`Team deleted: ${deleted.name}`);
    return deleted;
  }
}

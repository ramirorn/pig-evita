// ===========================================
// Teams Service
// ===========================================
import {
  Injectable,
  ConflictException,
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
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateTeamDto) {
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

  async findAll(filterDto: TeamFilterDto) {
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

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        include: {
          category: { include: { discipline: true } },
          _count: { select: { members: true } },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: {
          [filterDto.sortBy || 'createdAt']: filterDto.sortOrder || 'desc',
        },
      }),
      this.prisma.team.count({ where }),
    ]);

    return buildPaginatedResponse(teams, total, filterDto);
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        category: { include: { discipline: true } },
        members: {
          include: { participant: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Equipo no encontrado');
    }

    return team;
  }

  async update(id: string, updateDto: UpdateTeamDto) {
    await this.findOne(id); // verifica existencia

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

  async addMember(teamId: string, addMemberDto: AddTeamMemberDto) {
    const team = await this.findOne(teamId);

    // 1. Validar tamaño máximo del equipo
    const currentMembers = team.members.length;
    const maxPlayers = team.category.discipline.maxPlayers;
    if (maxPlayers && currentMembers >= maxPlayers) {
      throw new BadRequestException(
        `El equipo alcanzó su límite máximo de ${maxPlayers} miembros`,
      );
    }

    // 2. Verificar que el participante existe
    const participant = await this.prisma.participant.findUnique({
      where: { id: addMemberDto.participantId },
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

  async removeMember(teamId: string, participantId: string) {
    await this.findOne(teamId); // Verifica equipo

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
}

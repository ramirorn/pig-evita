// ===========================================
// Participants Service
// ===========================================
import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantFilterDto,
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo participante.
   */
  async create(createDto: CreateParticipantDto) {
    // Verificar DNI único
    const existing = await this.prisma.participant.findUnique({
      where: { dni: createDto.dni },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un participante con DNI ${createDto.dni}`,
      );
    }

    const participant = await this.prisma.participant.create({
      data: {
        ...createDto,
        birthDate: new Date(createDto.birthDate),
      },
    });

    this.logger.log(
      `Participant created: ${participant.dni} - ${participant.lastName}, ${participant.firstName}`,
    );
    return participant;
  }

  /**
   * Listar participantes con paginación y filtros.
   */
  async findAll(filterDto: ParticipantFilterDto) {
    const where: Prisma.ParticipantWhereInput = {};

    if (filterDto.dni) {
      where.dni = { contains: filterDto.dni };
    }

    if (filterDto.department) {
      where.department = {
        contains: filterDto.department,
        mode: 'insensitive',
      };
    }

    if (filterDto.locality) {
      where.locality = { contains: filterDto.locality, mode: 'insensitive' };
    }

    if (filterDto.sex) {
      where.sex = filterDto.sex;
    }

    // Búsqueda general por nombre, apellido o DNI
    if (filterDto.search) {
      where.OR = [
        { firstName: { contains: filterDto.search, mode: 'insensitive' } },
        { lastName: { contains: filterDto.search, mode: 'insensitive' } },
        { dni: { contains: filterDto.search } },
      ];
    }

    const [participants, total] = await Promise.all([
      this.prisma.participant.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: {
          [filterDto.sortBy || 'createdAt']: filterDto.sortOrder || 'desc',
        },
      }),
      this.prisma.participant.count({ where }),
    ]);

    return buildPaginatedResponse(participants, total, filterDto);
  }

  /**
   * Buscar por ID.
   */
  async findOne(id: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: {
        inscriptions: {
          include: { category: { include: { discipline: true } } },
        },
        documents: true,
        teamMembers: {
          include: { team: true },
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participante no encontrado');
    }

    return participant;
  }

  /**
   * Buscar por DNI.
   */
  async findByDni(dni: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { dni },
    });

    if (!participant) {
      throw new NotFoundException(`No se encontró participante con DNI ${dni}`);
    }

    return participant;
  }

  /**
   * Actualizar participante.
   */
  async update(id: string, updateDto: UpdateParticipantDto) {
    await this.findOne(id);

    // Si se cambia el DNI, verificar unicidad
    if (updateDto.dni) {
      const existing = await this.prisma.participant.findFirst({
        where: {
          dni: updateDto.dni,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe un participante con DNI ${updateDto.dni}`,
        );
      }
    }

    const data: Prisma.ParticipantUpdateInput = { ...updateDto };
    if (updateDto.birthDate) {
      data.birthDate = new Date(updateDto.birthDate);
    }

    const participant = await this.prisma.participant.update({
      where: { id },
      data,
    });

    this.logger.log(`Participant updated: ${participant.dni}`);
    return participant;
  }
}

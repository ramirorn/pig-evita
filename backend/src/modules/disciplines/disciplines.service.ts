// ===========================================
// Disciplines Service
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
  CreateDisciplineDto,
  UpdateDisciplineDto,
  DisciplineFilterDto,
  CAMPOS_ORDEN_DISCIPLINE,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class DisciplinesService {
  private readonly logger = new Logger(DisciplinesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateDisciplineDto) {
    const existing = await this.prisma.discipline.findFirst({
      where: { name: { equals: createDto.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(
        `La disciplina "${createDto.name}" ya existe`,
      );
    }

    const discipline = await this.prisma.discipline.create({
      data: createDto,
    });

    this.logger.log(`Discipline created: ${discipline.name}`);
    return discipline;
  }

  async findAll(filterDto: DisciplineFilterDto) {
    const where: Prisma.DisciplineWhereInput = {};

    if (filterDto.type) {
      where.type = filterDto.type;
    }

    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto.search) {
      where.name = { contains: filterDto.search, mode: 'insensitive' };
    }

    const [disciplines, total] = await Promise.all([
      this.prisma.discipline.findMany({
        where,
        include: { _count: { select: { categories: true } } },
        skip: filterDto.skip,
        take: filterDto.take,
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_DISCIPLINE,
          'name',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.discipline.count({ where }),
    ]);

    return buildPaginatedResponse(disciplines, total, filterDto);
  }

  async findOne(id: string) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id },
      include: {
        categories: {
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!discipline) {
      throw new NotFoundException('Disciplina no encontrada');
    }

    return discipline;
  }

  async update(id: string, updateDto: UpdateDisciplineDto) {
    await this.findOne(id);

    if (updateDto.name) {
      const existing = await this.prisma.discipline.findFirst({
        where: {
          name: { equals: updateDto.name, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `La disciplina "${updateDto.name}" ya existe`,
        );
      }
    }

    const discipline = await this.prisma.discipline.update({
      where: { id },
      data: updateDto,
    });

    this.logger.log(`Discipline updated: ${discipline.name}`);
    return discipline;
  }

  async remove(id: string) {
    const discipline = await this.findOne(id);

    const counts = await this.prisma.discipline.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            competitions: true,
            teams: true,
          },
        },
      },
    });

    if (counts && (counts._count.competitions > 0 || counts._count.teams > 0)) {
      this.logger.log(
        `Discipline ${discipline.name} has associated competitions/teams, deactivating instead of permanent delete`,
      );
      return this.prisma.discipline.update({
        where: { id },
        data: { isActive: false },
      });
    }

    const deleted = await this.prisma.discipline.delete({
      where: { id },
    });

    this.logger.log(`Discipline deleted: ${deleted.name}`);
    return deleted;
  }
}

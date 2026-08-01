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
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';

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
        orderBy: { [filterDto.sortBy || 'name']: filterDto.sortOrder || 'asc' },
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
}

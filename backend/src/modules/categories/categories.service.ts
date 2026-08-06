// ===========================================
// Categories Service
// ===========================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCategoryDto) {
    if (createDto.minAge > createDto.maxAge) {
      throw new BadRequestException(
        'La edad mínima no puede ser mayor a la edad máxima',
      );
    }

    // Verificar que la disciplina existe
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: createDto.disciplineId },
    });

    if (!discipline) {
      throw new NotFoundException('La disciplina especificada no existe');
    }

    const category = await this.prisma.category.create({
      data: createDto,
    });

    this.logger.log(
      `Category created: ${category.name} in discipline ${discipline.name}`,
    );
    return category;
  }

  async findAll(filterDto: CategoryFilterDto) {
    const where: Prisma.CategoryWhereInput = {};

    if (filterDto.disciplineId) {
      where.disciplineId = filterDto.disciplineId;
    }

    if (filterDto.sex) {
      where.sex = filterDto.sex;
    }

    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto.search) {
      where.name = { contains: filterDto.search, mode: 'insensitive' };
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: { discipline: true },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: [{ discipline: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    return buildPaginatedResponse(categories, total, filterDto);
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        discipline: true,
        _count: { select: { inscriptions: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async update(id: string, updateDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    const minAge = updateDto.minAge ?? category.minAge;
    const maxAge = updateDto.maxAge ?? category.maxAge;

    if (minAge > maxAge) {
      throw new BadRequestException(
        'La edad mínima no puede ser mayor a la edad máxima',
      );
    }

    if (updateDto.disciplineId) {
      const discipline = await this.prisma.discipline.findUnique({
        where: { id: updateDto.disciplineId },
      });
      if (!discipline) {
        throw new NotFoundException('La disciplina especificada no existe');
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateDto,
      include: { discipline: true },
    });

    this.logger.log(`Category updated: ${updated.name}`);
    return updated;
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    const counts = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inscriptions: true,
            teams: true,
            competitions: true,
          },
        },
      },
    });

    if (
      counts &&
      (counts._count.inscriptions > 0 ||
        counts._count.teams > 0 ||
        counts._count.competitions > 0)
    ) {
      this.logger.log(
        `Category ${category.name} has associated data, deactivating instead of permanent delete`,
      );
      return this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
    }

    const deleted = await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted: ${deleted.name}`);
    return deleted;
  }
}

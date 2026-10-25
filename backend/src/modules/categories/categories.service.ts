// ===========================================
// Categories Service
// ===========================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AgeCriterion, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';

/** Los cuatro campos del rango, ya resueltos para el criterio elegido. */
interface RangoNormalizado {
  ageCriterion: AgeCriterion;
  minAge: number | null;
  maxAge: number | null;
  minBirthYear: number | null;
  maxBirthYear: number | null;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCategoryDto) {
    const rango = this.normalizarRango(createDto);

    // Verificar que la disciplina existe
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: createDto.disciplineId },
    });

    if (!discipline) {
      throw new NotFoundException('La disciplina especificada no existe');
    }

    const category = await this.prisma.category.create({
      data: { ...createDto, ...rango },
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

    // Si el criterio cambia, el par del criterio anterior no sirve de base:
    // la nueva elección tiene que traer su propio rango completo.
    const ageCriterion = updateDto.ageCriterion ?? category.ageCriterion;
    const base: Partial<RangoNormalizado> =
      ageCriterion === category.ageCriterion ? category : {};
    const rango = this.normalizarRango({
      ageCriterion,
      minAge: updateDto.minAge ?? base.minAge,
      maxAge: updateDto.maxAge ?? base.maxAge,
      minBirthYear: updateDto.minBirthYear ?? base.minBirthYear,
      maxBirthYear: updateDto.maxBirthYear ?? base.maxBirthYear,
    });

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
      data: { ...updateDto, ...rango },
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

  /**
   * Resuelve el rango según el criterio: exige el par del criterio elegido,
   * valida su orden y deja en NULL el del otro (el CHECK de la tabla lo exige).
   */
  private normalizarRango(input: {
    ageCriterion?: AgeCriterion | null;
    minAge?: number | null;
    maxAge?: number | null;
    minBirthYear?: number | null;
    maxBirthYear?: number | null;
  }): RangoNormalizado {
    const ageCriterion = input.ageCriterion ?? AgeCriterion.AGE;

    if (ageCriterion === AgeCriterion.BIRTH_YEAR) {
      const { minBirthYear, maxBirthYear } = input;
      if (minBirthYear == null || maxBirthYear == null) {
        throw new BadRequestException(
          'Indicá el año de nacimiento desde y hasta de la categoría',
        );
      }
      if (minBirthYear > maxBirthYear) {
        throw new BadRequestException(
          'El año de nacimiento "desde" no puede ser posterior al "hasta"',
        );
      }
      if (maxBirthYear > new Date().getFullYear()) {
        throw new BadRequestException(
          'El año de nacimiento no puede ser posterior al año actual',
        );
      }
      return {
        ageCriterion,
        minAge: null,
        maxAge: null,
        minBirthYear,
        maxBirthYear,
      };
    }

    const { minAge, maxAge } = input;
    if (minAge == null || maxAge == null) {
      throw new BadRequestException(
        'Indicá la edad mínima y máxima de la categoría',
      );
    }
    if (minAge > maxAge) {
      throw new BadRequestException(
        'La edad mínima no puede ser mayor a la edad máxima',
      );
    }
    return {
      ageCriterion,
      minAge,
      maxAge,
      minBirthYear: null,
      maxBirthYear: null,
    };
  }
}

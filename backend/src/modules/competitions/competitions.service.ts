// ===========================================
// Competitions Service
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
import { CreateCompetitionDto, UpdateCompetitionDto, CompetitionFilterDto, GenerateFixtureDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';
import { EngineFactory } from './engine.factory';

@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineFactory: EngineFactory,
  ) {}

  async create(createDto: CreateCompetitionDto) {
    const existing = await this.prisma.competition.findUnique({
      where: {
        disciplineId_categoryId_stage: {
          disciplineId: createDto.disciplineId,
          categoryId: createDto.categoryId,
          stage: createDto.stage,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe una competencia para esta disciplina, categoría y etapa');
    }

    // Verificar disciplina y categoría
    const category = await this.prisma.category.findUnique({
      where: { id: createDto.categoryId },
    });
    if (!category || category.disciplineId !== createDto.disciplineId) {
      throw new BadRequestException('Categoría inválida para la disciplina seleccionada');
    }

    const competition = await this.prisma.competition.create({
      data: {
        ...createDto,
        config: createDto.config ? (createDto.config as Prisma.InputJsonValue) : undefined,
        startDate: createDto.startDate ? new Date(createDto.startDate) : undefined,
        endDate: createDto.endDate ? new Date(createDto.endDate) : undefined,
      },
    });

    this.logger.log(`Competition created: ${competition.id}`);
    return competition;
  }

  async findAll(filterDto: CompetitionFilterDto) {
    const where: Prisma.CompetitionWhereInput = {};

    if (filterDto.disciplineId) where.disciplineId = filterDto.disciplineId;
    if (filterDto.categoryId) where.categoryId = filterDto.categoryId;
    if (filterDto.stage) where.stage = filterDto.stage;
    if (filterDto.status) where.status = filterDto.status;
    if (filterDto.search) {
      where.name = { contains: filterDto.search, mode: 'insensitive' };
    }

    const [competitions, total] = await Promise.all([
      this.prisma.competition.findMany({
        where,
        include: {
          discipline: true,
          category: true,
          _count: { select: { matches: true } },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: { [filterDto.sortBy || 'createdAt']: filterDto.sortOrder || 'desc' },
      }),
      this.prisma.competition.count({ where }),
    ]);

    return buildPaginatedResponse(competitions, total, filterDto);
  }

  async findOne(id: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      include: {
        discipline: true,
        category: true,
        matches: {
          include: {
            venue: true,
            results: {
              include: { team: true, participant: true }
            }
          },
          orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
        },
      },
    });

    if (!competition) {
      throw new NotFoundException('Competencia no encontrada');
    }

    return competition;
  }

  async update(id: string, updateDto: UpdateCompetitionDto) {
    await this.findOne(id); // verificar que existe

    // Prisma ignora automáticamente los campos undefined
    const updateData: Prisma.CompetitionUpdateInput = {
      ...updateDto,
      config: updateDto.config ? (updateDto.config as Prisma.InputJsonValue) : undefined,
      startDate: updateDto.startDate ? new Date(updateDto.startDate) : undefined,
      endDate: updateDto.endDate ? new Date(updateDto.endDate) : undefined,
    };

    const competition = await this.prisma.competition.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Competition updated: ${competition.id}`);
    return competition;
  }

  async generateFixture(id: string, generateDto: GenerateFixtureDto) {
    const competition = await this.findOne(id);

    if (competition.matches.length > 0) {
      throw new ConflictException('La competencia ya tiene un fixture generado');
    }

    const ids = generateDto.teamIds?.length ? generateDto.teamIds : generateDto.participantIds;
    if (!ids || ids.length < 2) {
      throw new BadRequestException('Debe proveer al menos 2 IDs de equipos o participantes');
    }

    const engine = this.engineFactory.getEngine(competition.format);
    await engine.generateFixture(competition, ids);

    // Cambiar estado a ACTIVA
    await this.prisma.competition.update({
      where: { id },
      data: { status: 'ACTIVA' },
    });

    this.logger.log(`Fixture generated for competition ${id}`);
    return this.findOne(id); // Devolver la competencia con sus partidos
  }
}

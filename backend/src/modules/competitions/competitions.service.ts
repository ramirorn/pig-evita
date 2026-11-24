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
import { InscriptionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCompetitionDto,
  UpdateCompetitionDto,
  CompetitionFilterDto,
  GenerateFixtureDto,
  CAMPOS_ORDEN_COMPETITION,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';
import { EngineFactory, TipoDeCompetidor } from './engine.factory';
import {
  COMPETITION_PUBLIC_DETAIL,
  MATCH_PUBLIC,
} from '../../common/prisma-selects';

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
      throw new ConflictException(
        'Ya existe una competencia para esta disciplina, categoría y etapa',
      );
    }

    // Verificar disciplina y categoría
    const category = await this.prisma.category.findUnique({
      where: { id: createDto.categoryId },
    });
    if (!category || category.disciplineId !== createDto.disciplineId) {
      throw new BadRequestException(
        'Categoría inválida para la disciplina seleccionada',
      );
    }

    const competition = await this.prisma.competition.create({
      data: {
        ...createDto,
        config: createDto.config
          ? (createDto.config as Prisma.InputJsonValue)
          : undefined,
        startDate: createDto.startDate
          ? new Date(createDto.startDate)
          : undefined,
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
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_COMPETITION,
          'createdAt',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.competition.count({ where }),
    ]);

    return buildPaginatedResponse(competitions, total, filterDto);
  }

  /**
   * Competencia con su fixture.
   *
   * El endpoint que la sirve es `@Public()`: cualquiera sin token la lee. Hasta
   * R01 bajaba con `results: { include: { participant: true } }`, es decir la
   * fila completa de `Participant` —DNI, fecha de nacimiento, email, teléfono y
   * domicilio de chicos menores de edad— publicada en la web. Es el mismo bug
   * que cerró T01 en `findByQr()`, un módulo más allá.
   *
   * Ahora proyecta con los selects compartidos de `common/prisma-selects.ts`:
   * el participante entra sólo con nombre y apellido (`PARTICIPANT_NAME`), y
   * `venue`/`category`/`discipline` dejan de arrastrar columnas nuevas por el
   * solo hecho de que alguien las agregue al esquema.
   */
  async findOne(id: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id },
      select: {
        ...COMPETITION_PUBLIC_DETAIL,
        matches: {
          select: MATCH_PUBLIC,
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
      config: updateDto.config
        ? (updateDto.config as Prisma.InputJsonValue)
        : undefined,
      startDate: updateDto.startDate
        ? new Date(updateDto.startDate)
        : undefined,
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
      throw new ConflictException(
        'La competencia ya tiene un fixture generado',
      );
    }

    // Quién compite lo decide **el llamador**, no una heurística sobre el id.
    // El motor adivinaba con `id.includes('-')`, que los uuid de participante
    // también cumplen: el fixture de una disciplina individual terminaba
    // escribiendo un `teamId` que apuntaba a un participante y explotaba con un
    // 500. Verificado en vivo antes de arreglarlo.
    const esPorEquipos = Boolean(generateDto.teamIds?.length);
    const ids = esPorEquipos ? generateDto.teamIds : generateDto.participantIds;
    if (!ids || ids.length < 2) {
      throw new BadRequestException(
        'Debe proveer al menos 2 IDs de equipos o participantes',
      );
    }
    const tipo: TipoDeCompetidor = esPorEquipos ? 'team' : 'participant';

    // F-13 — un id repetido armaba un partido de alguien contra sí mismo y
    // terminaba en un 500 por la unique de `Result`.
    const repetidos = ids.filter((valor, i) => ids.indexOf(valor) !== i);
    if (repetidos.length > 0) {
      throw new BadRequestException(
        `Hay competidores repetidos en el fixture: ${[...new Set(repetidos)].join(', ')}`,
      );
    }

    // F-09 / CA-C1.3 — sólo entra quien tiene la inscripción APROBADA en la
    // categoría de la competencia. Cubre también el id inexistente (F-13), que
    // antes llegaba hasta la foreign key y respondía 500.
    await this.verificarAdmitidos(competition.categoryId, ids, tipo);

    const engine = this.engineFactory.getEngine(competition.format);

    // F-13 — todo o nada: si un insert falla a mitad de camino, no queda un
    // fixture a medias que después bloquee el reintento con un 409.
    await this.prisma.$transaction(
      async (tx) => {
        await engine.generateFixture(competition, ids, tipo, tx);
        await tx.competition.update({
          where: { id },
          data: { status: 'ACTIVA' },
        });
      },
      // Un round robin grande son cientos de inserts secuenciales; el default
      // de 5 s de Prisma cortaría la transacción en medio.
      { timeout: 60_000 },
    );

    this.logger.log(`Fixture generated for competition ${id}`);
    return this.findOne(id); // Devolver la competencia con sus partidos
  }

  /**
   * Rechaza con 400 a todo competidor sin inscripción APROBADA en la categoría.
   *
   * Un equipo cuenta como admitido cuando está activo y tiene al menos una
   * inscripción APROBADA en la categoría: las inscripciones de un plantel son
   * por integrante, y quien no fue aprobado simplemente no juega.
   */
  private async verificarAdmitidos(
    categoryId: string,
    ids: string[],
    tipo: TipoDeCompetidor,
  ) {
    const admitidos = new Set<string | null>(
      tipo === 'team'
        ? (
            await this.prisma.inscription.findMany({
              where: {
                teamId: { in: ids },
                categoryId,
                status: InscriptionStatus.APROBADA,
                team: { isActive: true },
              },
              select: { teamId: true },
            })
          ).map((a) => a.teamId)
        : (
            await this.prisma.inscription.findMany({
              where: {
                participantId: { in: ids },
                categoryId,
                status: InscriptionStatus.APROBADA,
              },
              select: { participantId: true },
            })
          ).map((a) => a.participantId),
    );
    const faltan = ids.filter((valor) => !admitidos.has(valor));
    if (faltan.length > 0) {
      const quien = tipo === 'team' ? 'equipos' : 'participantes';
      throw new BadRequestException(
        `Sólo pueden entrar al fixture ${quien} con inscripción APROBADA en la categoría de la competencia. Sin inscripción aprobada: ${faltan.join(', ')}`,
      );
    }
  }
}

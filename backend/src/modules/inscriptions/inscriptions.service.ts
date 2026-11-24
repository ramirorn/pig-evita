// ===========================================
// Inscriptions Service — alta individual, listado y detalle
// ===========================================
//
// El resto del ciclo vive en servicios propios: revisión y aprobación
// (`InscriptionReviewService`), planteles (`TeamInscriptionsService`) y código
// QR (`InscriptionQrService`).
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, InscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateInscriptionDto, InscriptionFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';
import {
  CATEGORY_WITH_DISCIPLINE,
  PARTICIPANT_CONTACT,
  PARTICIPANT_SUMMARY,
  TEAM_MEMBER_WITH_PARTICIPANT,
  TEAM_SUMMARY,
  USER_SUMMARY,
} from '../../common/prisma-selects';
import { Alcance, ScopeService } from '../../common/scope';
import { InscriptionQrService } from './inscription-qr.service';
import { individualEligibilityError } from './inscription-eligibility';

@Injectable()
export class InscriptionsService {
  private readonly logger = new Logger(InscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly qr: InscriptionQrService,
  ) {}

  /**
   * Alta individual: crea o reutiliza el participante por DNI, valida la
   * elegibilidad para la categoría y genera el código QR.
   */
  async create(
    createDto: CreateInscriptionDto,
    createdById: string,
    alcance: Alcance,
  ) {
    const { department, categoryId, teamId } = createDto;

    // R05 — el alta crea o reutiliza un participante con el departamento del
    // body: sin este corte, un delegado podía tocar el padrón ajeno.
    if (!this.scope.permiteDepartamento(alcance, department)) {
      throw new ForbiddenException(
        `No podés inscribir participantes del departamento "${department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { discipline: true },
    });
    if (!category) {
      throw new BadRequestException('La categoría seleccionada no existe');
    }
    if (!category.isActive) {
      throw new BadRequestException('La categoría seleccionada no está activa');
    }

    const birthDate = new Date(createDto.birthDate);
    const ineligible = individualEligibilityError(
      category,
      birthDate,
      createDto.sex,
    );
    if (ineligible) throw new BadRequestException(ineligible);

    const qrCode = this.qr.generateCode();

    // R13 — equipo, participante e inscripción en una sola transacción: antes,
    // si fallaba la inscripción quedaba un participante huérfano, y dos altas
    // simultáneas del mismo DNI pasaban las dos el chequeo de duplicado. Lo que
    // no toca la base (validaciones, QR, imagen) queda afuera.
    const inscription = await this.prisma.$transaction(async (tx) => {
      if (teamId) await this.assertTeamInScope(tx, teamId, categoryId, alcance);

      const participant = await this.findOrCreateParticipant(
        tx,
        createDto,
        birthDate,
        createdById,
        alcance,
      );

      const existing = await tx.inscription.findUnique({
        where: {
          participantId_categoryId: {
            participantId: participant.id,
            categoryId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          'El participante ya está inscripto en esta categoría',
        );
      }

      return tx.inscription.create({
        data: {
          participantId: participant.id,
          categoryId,
          teamId,
          qrCode,
          createdById,
          status: InscriptionStatus.PENDIENTE,
        },
        include: {
          // S04/S10 — proyección y no `participant: true`, que arrastraba el
          // domicilio y cualquier columna nueva.
          participant: { select: PARTICIPANT_CONTACT },
          category: { include: { discipline: true } },
        },
      });
    });

    const qrImage = await this.qr.renderImage(qrCode);

    // VULN-25/VULN-32 — ids internos: ni el DNI del menor ni el código QR
    // (la llave del endpoint público) van al log.
    this.logger.log(
      `Inscription created: ${inscription.id} for participant ` +
        `${inscription.participantId} in ${category.name}`,
    );

    return { ...inscription, qrImage };
  }

  /**
   * VULN-06 — el `teamId` lo manda el cliente y la FK sólo garantiza que
   * exista. Se busca con el alcance y la categoría adentro del `where`: un
   * equipo ajeno responde igual que uno inexistente (404, no 403, como R06).
   */
  private async assertTeamInScope(
    tx: Prisma.TransactionClient,
    teamId: string,
    categoryId: string,
    alcance: Alcance,
  ): Promise<void> {
    const team = await tx.team.findFirst({
      where: ScopeService.conAlcance<Prisma.TeamWhereInput>(
        { id: teamId, categoryId },
        this.scope.whereTeam(alcance),
      ),
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException(
        'Equipo no encontrado en la categoría seleccionada',
      );
    }
  }

  /**
   * S04 — la búsqueda por DNI lleva el alcance adentro del `where`: un DNI de
   * otro territorio cae en la rama de creación, donde la unique lo corta con
   * el mismo 409 que cualquier duplicado. No se puede distinguir "existe pero
   * no es tuyo" de "no existe".
   */
  private async findOrCreateParticipant(
    tx: Prisma.TransactionClient,
    dto: CreateInscriptionDto,
    birthDate: Date,
    createdById: string,
    alcance: Alcance,
  ) {
    const found = await tx.participant.findFirst({
      where: { dni: dto.dni, ...this.scope.whereParticipant(alcance) },
    });
    if (found) return found;

    try {
      const created = await tx.participant.create({
        data: {
          dni: dto.dni,
          firstName: dto.firstName,
          lastName: dto.lastName,
          birthDate,
          sex: dto.sex,
          phone: dto.phone,
          email: dto.email,
          locality: dto.locality,
          department: dto.department,
          address: dto.address,
        },
      });
      // VULN-25 — el id interno y no el DNI de un menor.
      this.logger.log(`New participant created: ${created.id}`);
      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // VULN-44 — la unique global de `dni` confirma que existe en otro
        // territorio; se registra quién lo provoca para detectar su uso como
        // oráculo. El mensaje es neutro a propósito (S04).
        this.logger.warn(
          `Alta rechazada por DNI existente fuera del alcance ` +
            `(usuario ${createdById})`,
        );
        throw new ConflictException(
          'Ya existe un participante con ese DNI. Si es de tu departamento, ' +
            'buscalo en el padrón; si no, pedí el alta a un administrador.',
        );
      }
      throw error;
    }
  }

  /** Listado paginado con filtros, recortado al alcance territorial. */
  async findAll(filterDto: InscriptionFilterDto, alcance: Alcance) {
    const where: Prisma.InscriptionWhereInput = {};

    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.categoryId) {
      where.categoryId = filterDto.categoryId;
    }

    if (filterDto.department) {
      where.participant = {
        department: { contains: filterDto.department, mode: 'insensitive' },
      };
    }

    if (filterDto.search) {
      where.OR = [
        {
          participant: {
            firstName: { contains: filterDto.search, mode: 'insensitive' },
          },
        },
        {
          participant: {
            lastName: { contains: filterDto.search, mode: 'insensitive' },
          },
        },
        { participant: { dni: { contains: filterDto.search } } },
        { qrCode: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // R05 — el departamento de una inscripción es el de su participante.
    const whereInScope = ScopeService.conAlcance(
      where,
      this.scope.whereInscription(alcance),
    );

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where: whereInScope,
        // Sólo lo que muestra la tabla; notas y fechas de revisión quedan
        // para el detalle.
        select: {
          id: true,
          qrCode: true,
          status: true,
          createdAt: true,
          participant: { select: PARTICIPANT_SUMMARY },
          category: { select: CATEGORY_WITH_DISCIPLINE },
          team: { select: TEAM_SUMMARY },
          createdBy: { select: USER_SUMMARY },
          reviewedBy: { select: USER_SUMMARY },
          approvedBy: { select: USER_SUMMARY },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inscription.count({ where: whereInScope }),
    ]);

    return buildPaginatedResponse(inscriptions, total, filterDto);
  }

  /**
   * Detalle con contacto, notas y trazabilidad. Fuera de alcance responde 404,
   * igual que un id inexistente.
   */
  async findOne(id: string, alcance: Alcance) {
    const inscription = await this.prisma.inscription.findFirst({
      where: ScopeService.conAlcance(
        { id },
        this.scope.whereInscription(alcance),
      ),
      // Los documentos tienen su propio endpoint (`GET /documents/participant/:id`).
      select: {
        id: true,
        qrCode: true,
        status: true,
        notes: true,
        rejectionNote: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        approvedAt: true,
        participant: { select: PARTICIPANT_CONTACT },
        category: { select: CATEGORY_WITH_DISCIPLINE },
        team: {
          select: {
            ...TEAM_SUMMARY,
            members: { select: TEAM_MEMBER_WITH_PARTICIPANT },
          },
        },
        createdBy: { select: USER_SUMMARY },
        reviewedBy: { select: USER_SUMMARY },
        approvedBy: { select: USER_SUMMARY },
      },
    });

    if (!inscription) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscription;
  }
}

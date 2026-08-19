// ===========================================
// Inscriptions Service
// ===========================================
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, InscriptionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateInscriptionDto,
  ReviewInscriptionDto,
  RejectInscriptionDto,
  InscriptionFilterDto,
  PublicInscriptionDto,
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class InscriptionsService {
  private readonly logger = new Logger(InscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear inscripción (endpoint público via QR).
   * - Crea o reutiliza el participante por DNI.
   * - Valida edad vs categoría.
   * - Genera código QR único.
   */
  async create(createDto: CreateInscriptionDto, createdById: string) {
    const {
      dni,
      firstName,
      lastName,
      birthDate,
      sex,
      phone,
      email,
      locality,
      department,
      address,
      categoryId,
      teamId,
    } = createDto;

    // 1. Verificar que la categoría existe y obtener su disciplina
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

    // 2. Validar edad del participante
    const birthDateObj = new Date(birthDate);
    const age = this.calculateAge(birthDateObj);

    if (age < category.minAge || age > category.maxAge) {
      throw new BadRequestException(
        `La edad del participante (${age} años) no cumple con el rango de la categoría (${category.minAge}-${category.maxAge} años)`,
      );
    }

    // 3. Validar sexo vs categoría
    if (category.sex !== 'MIXTO' && category.sex !== sex) {
      throw new BadRequestException(
        `El sexo del participante no coincide con la categoría (${category.sex})`,
      );
    }

    // 4. Crear o encontrar participante por DNI
    let participant = await this.prisma.participant.findUnique({
      where: { dni },
    });

    if (!participant) {
      participant = await this.prisma.participant.create({
        data: {
          dni,
          firstName,
          lastName,
          birthDate: birthDateObj,
          sex,
          phone,
          email,
          locality,
          department,
          address,
        },
      });
      this.logger.log(`New participant created: ${dni}`);
    }

    // 5. Verificar que no esté ya inscripto en esta categoría
    const existingInscription = await this.prisma.inscription.findUnique({
      where: {
        participantId_categoryId: {
          participantId: participant.id,
          categoryId,
        },
      },
    });

    if (existingInscription) {
      throw new ConflictException(
        'El participante ya está inscripto en esta categoría',
      );
    }

    // 6. Generar código QR único
    const qrCode = `EVITA-${uuidv4().slice(0, 8).toUpperCase()}`;

    // 7. Crear inscripción
    const inscription = await this.prisma.inscription.create({
      data: {
        participantId: participant.id,
        categoryId,
        teamId,
        qrCode,
        createdById,
        status: InscriptionStatus.PENDIENTE,
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    // 8. Generar imagen QR
    const qrImage = await QRCode.toDataURL(qrCode, {
      width: 300,
      margin: 2,
      color: { dark: '#0F4C81', light: '#FFFFFF' },
    });

    this.logger.log(
      `Inscription created: ${qrCode} for ${dni} in ${category.name}`,
    );

    return {
      ...inscription,
      qrImage,
    };
  }

  /**
   * Listar inscripciones con paginación y filtros.
   */
  async findAll(filterDto: InscriptionFilterDto) {
    const where: Prisma.InscriptionWhereInput = {};

    if (filterDto.status) {
      where.status = filterDto.status as InscriptionStatus;
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

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where,
        include: {
          participant: true,
          category: { include: { discipline: true } },
          team: true,
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inscription.count({ where }),
    ]);

    return buildPaginatedResponse(inscriptions, total, filterDto);
  }

  /**
   * Obtener inscripción por ID.
   */
  async findOne(id: string) {
    const inscription = await this.prisma.inscription.findUnique({
      where: { id },
      include: {
        participant: { include: { documents: true } },
        category: { include: { discipline: true } },
        team: { include: { members: { include: { participant: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!inscription) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscription;
  }

  /**
   * Buscar inscripción por código QR (endpoint PÚBLICO, sin autenticación).
   *
   * Superficie de datos mínima a propósito: cualquier persona que conozca el
   * código QR puede llamar a este endpoint. Se exponen únicamente nombre y
   * apellido del participante, disciplina, categoría y estado del trámite.
   * NO agregar dni, email, phone, birthDate, address, department ni notas
   * internas (`notes` / `rejectionNote`) al `select` ni al objeto devuelto.
   */
  async findByQr(qrCode: string): Promise<PublicInscriptionDto> {
    const inscription = await this.prisma.inscription.findUnique({
      where: { qrCode },
      select: {
        qrCode: true,
        status: true,
        createdAt: true,
        participant: { select: { firstName: true, lastName: true } },
        category: {
          select: {
            name: true,
            discipline: { select: { name: true } },
          },
        },
      },
    });

    if (!inscription) {
      throw new NotFoundException(
        'Inscripción no encontrada para el código QR proporcionado',
      );
    }

    // Mapeo explícito: evita que un cambio futuro en el `select` filtre campos
    // nuevos sin pasar por una revisión de este contrato.
    return {
      qrCode: inscription.qrCode,
      status: inscription.status,
      createdAt: inscription.createdAt,
      participant: {
        firstName: inscription.participant.firstName,
        lastName: inscription.participant.lastName,
      },
      category: {
        name: inscription.category.name,
        discipline: { name: inscription.category.discipline.name },
      },
    };
  }

  /**
   * Revisar inscripción (Delegado).
   * Estado: PENDIENTE → REVISADA
   */
  async review(id: string, userId: string, reviewDto: ReviewInscriptionDto) {
    const inscription = await this.findOne(id);

    if (inscription.status !== InscriptionStatus.PENDIENTE) {
      throw new BadRequestException(
        `No se puede revisar una inscripción con estado "${inscription.status}"`,
      );
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.REVISADA,
        reviewedById: userId,
        reviewedAt: new Date(),
        notes: reviewDto.notes,
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription reviewed: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Aprobar inscripción (Administrador).
   * Estado: REVISADA → APROBADA
   */
  async approve(id: string, userId: string) {
    const inscription = await this.findOne(id);

    if (inscription.status !== InscriptionStatus.REVISADA) {
      throw new BadRequestException(
        `Solo se pueden aprobar inscripciones con estado "REVISADA". Estado actual: "${inscription.status}"`,
      );
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.APROBADA,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription approved: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Rechazar inscripción.
   * Estado: PENDIENTE|REVISADA → RECHAZADA
   */
  async reject(id: string, userId: string, rejectDto: RejectInscriptionDto) {
    const inscription = await this.findOne(id);

    if (inscription.status === InscriptionStatus.APROBADA) {
      throw new BadRequestException(
        'No se puede rechazar una inscripción ya aprobada',
      );
    }

    if (inscription.status === InscriptionStatus.RECHAZADA) {
      throw new BadRequestException('La inscripción ya fue rechazada');
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.RECHAZADA,
        rejectionNote: rejectDto.rejectionNote,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription rejected: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Calcula la edad basada en la fecha de nacimiento.
   */
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
}

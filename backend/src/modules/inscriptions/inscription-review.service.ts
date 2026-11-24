// ===========================================
// Flujo de revisión de inscripciones
// ===========================================
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InscriptionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Alcance } from '../../common/scope';
import { PARTICIPANT_CONTACT } from '../../common/prisma-selects';
import { RejectInscriptionDto, ReviewInscriptionDto } from './dto';
import { InscriptionsService } from './inscriptions.service';

/**
 * Lo que devuelven las transiciones. Antes era `participant: true`: la fila
 * entera con el domicilio, que ninguna pantalla usa y que `PARTICIPANT_CONTACT`
 * deja afuera a propósito (S04/S10).
 */
const REVIEW_RESULT = {
  participant: { select: PARTICIPANT_CONTACT },
  category: { include: { discipline: true } },
} satisfies Prisma.InscriptionInclude;

/**
 * Transiciones de estado de una inscripción:
 * PENDIENTE → REVISADA → APROBADA, y PENDIENTE|REVISADA → RECHAZADA.
 *
 * Cada transición busca la inscripción con `findOne`, que aplica el alcance
 * territorial: una inscripción de otro departamento responde 404 antes de
 * cambiar ningún estado.
 */
@Injectable()
export class InscriptionReviewService {
  private readonly logger = new Logger(InscriptionReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inscriptions: InscriptionsService,
  ) {}

  /** Revisar (delegado): PENDIENTE → REVISADA. */
  async review(
    id: string,
    userId: string,
    reviewDto: ReviewInscriptionDto,
    alcance: Alcance,
  ) {
    const inscription = await this.inscriptions.findOne(id, alcance);

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
      include: REVIEW_RESULT,
    });

    this.logger.log(`Inscription reviewed: ${updated.id} by user ${userId}`);
    return updated;
  }

  /** Aprobar (administrador): REVISADA → APROBADA. */
  async approve(id: string, userId: string, alcance: Alcance) {
    const inscription = await this.inscriptions.findOne(id, alcance);

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
      include: REVIEW_RESULT,
    });

    this.logger.log(`Inscription approved: ${updated.id} by user ${userId}`);
    return updated;
  }

  /** Rechazar: PENDIENTE|REVISADA → RECHAZADA. */
  async reject(
    id: string,
    userId: string,
    rejectDto: RejectInscriptionDto,
    alcance: Alcance,
  ) {
    const inscription = await this.inscriptions.findOne(id, alcance);

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
      include: REVIEW_RESULT,
    });

    this.logger.log(`Inscription rejected: ${updated.id} by user ${userId}`);
    return updated;
  }
}

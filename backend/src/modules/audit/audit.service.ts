// ===========================================
// Audit Service
// ===========================================
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse } from '../../common/dto';
import { AuditFilterDto } from './dto';
import { sanitizeAuditChanges } from './audit-sanitizer';

/**
 * Contrato de entrada de un evento de auditoría, común a las dos vías
 * (interceptor y llamadas manuales). Reemplaza al tipo inline que tenía `log()`
 * y al helper privado que `AuthService` mantenía en paralelo (T25).
 */
export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  /** Payload crudo: `log()` lo sanea, quien llama no debe hacerlo. */
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registrar una acción de auditoría.
   *
   * Punto de entrada **único** para escribir en `AuditLog`: lo usan tanto el
   * `AuditInterceptor` (CRUD) como los eventos no-CRUD de `AuthService`. Que
   * sea uno solo es lo que garantiza que el saneamiento de `changes` se
   * aplique sí o sí — antes cada vía tenía su propia lógica y sólo una
   * limpiaba algo. Ver el contrato en
   * `common/decorators/audit.decorator.ts`.
   *
   * `changes` se recibe crudo a propósito: quien llama no tiene que acordarse
   * de sanear. `sanitizeAuditChanges` recorre el árbol completo y redacta
   * secretos y PII antes de que toquen la base.
   */
  async log(data: AuditLogInput): Promise<void> {
    const changes = sanitizeAuditChanges(data.changes);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId ?? null,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId ?? null,
          changes: changes ? (changes as Prisma.InputJsonValue) : undefined,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
        },
      });
    } catch (error) {
      // La auditoría nunca debe voltear la operación que la originó: si la
      // fila no entra, se avisa por log y la request sigue su curso.
      this.logger.warn(`Failed to create audit log: ${error}`);
    }
  }

  /**
   * Consultar logs de auditoría con paginación y filtros.
   */
  async findAll(query: AuditFilterDto) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.entity) {
      where.entity = { contains: query.entity, mode: 'insensitive' };
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(logs, total, query);
  }
}

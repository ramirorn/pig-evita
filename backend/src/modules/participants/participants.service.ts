// ===========================================
// Participants Service
// ===========================================
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantFilterDto,
  CAMPOS_ORDEN_PARTICIPANT,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, DNI_EDITORS, Role } from '../../common/constants';
import type { JwtPayload } from '../auth/interfaces';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crear un nuevo participante.
   */
  async create(createDto: CreateParticipantDto) {
    // Verificar DNI único
    const existing = await this.prisma.participant.findUnique({
      where: { dni: createDto.dni },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un participante con DNI ${createDto.dni}`,
      );
    }

    const participant = await this.prisma.participant.create({
      data: {
        ...createDto,
        birthDate: new Date(createDto.birthDate),
      },
    });

    this.logger.log(
      `Participant created: ${participant.dni} - ${participant.lastName}, ${participant.firstName}`,
    );
    return participant;
  }

  /**
   * Listar participantes con paginación y filtros.
   */
  async findAll(filterDto: ParticipantFilterDto) {
    const where: Prisma.ParticipantWhereInput = {};

    if (filterDto.dni) {
      where.dni = { contains: filterDto.dni };
    }

    if (filterDto.department) {
      where.department = {
        contains: filterDto.department,
        mode: 'insensitive',
      };
    }

    if (filterDto.locality) {
      where.locality = { contains: filterDto.locality, mode: 'insensitive' };
    }

    if (filterDto.sex) {
      where.sex = filterDto.sex;
    }

    if (filterDto.disciplineId || filterDto.categoryId) {
      where.inscriptions = {
        some: {
          ...(filterDto.categoryId ? { categoryId: filterDto.categoryId } : {}),
          ...(filterDto.disciplineId
            ? { category: { disciplineId: filterDto.disciplineId } }
            : {}),
        },
      };
    }

    // Búsqueda general por nombre, apellido o DNI
    if (filterDto.search) {
      where.OR = [
        { firstName: { contains: filterDto.search, mode: 'insensitive' } },
        { lastName: { contains: filterDto.search, mode: 'insensitive' } },
        { dni: { contains: filterDto.search } },
      ];
    }

    const [participants, total] = await Promise.all([
      this.prisma.participant.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_PARTICIPANT,
          'createdAt',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.participant.count({ where }),
    ]);

    return buildPaginatedResponse(participants, total, filterDto);
  }

  /**
   * Buscar por ID.
   */
  async findOne(id: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { id },
      include: {
        inscriptions: {
          include: { category: { include: { discipline: true } } },
        },
        documents: true,
        teamMembers: {
          include: { team: true },
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participante no encontrado');
    }

    return participant;
  }

  /**
   * Buscar por DNI.
   */
  async findByDni(dni: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { dni },
    });

    if (!participant) {
      throw new NotFoundException(`No se encontró participante con DNI ${dni}`);
    }

    return participant;
  }

  /** ¿El actor tiene uno de los roles habilitados a cambiar el DNI? */
  private puedeEditarDni(actor?: JwtPayload): boolean {
    return Boolean(actor && DNI_EDITORS.includes(actor.role as Role));
  }

  /**
   * Actualizar participante.
   */
  async update(
    id: string,
    updateDto: UpdateParticipantDto,
    actor?: JwtPayload,
  ) {
    const actual = await this.findOne(id);

    // -------------------------------------------------
    // R17 — el DNI no es un campo más del PATCH
    // -------------------------------------------------
    //
    // `UpdateParticipantDto extends PartialType(CreateParticipantDto)`, así que
    // heredaba `dni` sin más, y `@Roles(..., DELEGADO)` habilitaba el endpoint
    // entero. Un delegado podía, sobre una inscripción ya aprobada, cambiarle el
    // documento al participante: la fila sigue teniendo el mismo id, el mismo
    // equipo y la misma categoría, pero adentro hay otra persona. La auditoría
    // lo registraba como un UPDATE cualquiera.
    //
    // Se rechaza con 400 en vez de ignorar el campo en silencio: quien mandó el
    // DNI tiene que enterarse de que no se aplicó. Un descarte mudo deja al
    // delegado creyendo que corrigió el documento.
    //
    // Sólo se corta si el valor **cambia**: los formularios del frontend mandan
    // el objeto completo, y rechazar un PATCH que reenvía el mismo DNI sería
    // romper la edición de teléfono para el rol que hace la mayoría de las
    // ediciones.
    const cambiaDni =
      updateDto.dni !== undefined && updateDto.dni !== actual.dni;

    if (cambiaDni && !this.puedeEditarDni(actor)) {
      throw new BadRequestException(
        'No tiene permisos para modificar el DNI de un participante. ' +
          'Solicitá el cambio a un administrador provincial.',
      );
    }

    // Si se cambia el DNI, verificar unicidad
    if (updateDto.dni) {
      const existing = await this.prisma.participant.findFirst({
        where: {
          dni: updateDto.dni,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe un participante con DNI ${updateDto.dni}`,
        );
      }
    }

    const data: Prisma.ParticipantUpdateInput = { ...updateDto };
    if (updateDto.birthDate) {
      data.birthDate = new Date(updateDto.birthDate);
    }

    const participant = await this.prisma.participant.update({
      where: { id },
      data,
    });

    if (cambiaDni) {
      // Fila de auditoría propia, además del UPDATE que emite el interceptor:
      // ese registra el body y por lo tanto sólo el valor nuevo. Reconstruir a
      // qué documento apuntaba antes exigiría rastrear toda la historia de la
      // entidad. Acá quedan los dos juntos.
      //
      // Los valores van anidados bajo la clave `dni` a propósito: el
      // sanitizador clasifica por **nombre de clave**, así que `{ anterior:
      // { dni } }` sale enmascarado (`******56`) y un `{ dniAnterior: ... }`
      // plano habría guardado el documento en claro, que es justo lo que R12
      // vino a sacar de esta tabla.
      await this.auditService.log({
        userId: actor?.sub ?? null,
        action: AuditAction.DNI_CHANGE,
        entity: 'participants',
        entityId: id,
        changes: {
          anterior: { dni: actual.dni },
          nuevo: { dni: participant.dni },
        },
      });
      this.logger.warn(
        `DNI change on participant ${id} by user ${actor?.sub ?? 'desconocido'}`,
      );
    }

    this.logger.log(`Participant updated: ${participant.dni}`);
    return participant;
  }
}

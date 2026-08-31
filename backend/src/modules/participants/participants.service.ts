// ===========================================
// Participants Service
// ===========================================
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { Alcance, ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Crear un nuevo participante.
   */
  async create(createDto: CreateParticipantDto, alcance: Alcance) {
    // R05 — el alta también se acota: si no, un delegado no podría *ver* los
    // participantes de otro departamento pero sí crearlos ahí, y el padrón
    // terminaría con altas que su propio autor no puede volver a abrir.
    //
    // Acá sí va 403 y no 404: no se está preguntando por ninguna fila
    // existente, así que no hay nada que ocultar, y el delegado necesita
    // entender por qué no puede cargar al chico.
    if (!this.scope.permiteDepartamento(alcance, createDto.department)) {
      throw new ForbiddenException(
        `No podés cargar participantes del departamento "${createDto.department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

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
  async findAll(filterDto: ParticipantFilterDto, alcance: Alcance) {
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

    // R05 — el filtro del cliente y el recorte territorial se combinan con
    // `AND`: los dos pueden traer `OR` (el buscador de un lado, la lista de
    // departamentos del otro) y fusionarlos campo a campo haría que el último
    // gane, que en este caso significa mostrar de más.
    const whereConAlcance = ScopeService.conAlcance(
      where,
      this.scope.whereParticipant(alcance),
    );

    const [participants, total] = await Promise.all([
      this.prisma.participant.findMany({
        where: whereConAlcance,
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
      this.prisma.participant.count({ where: whereConAlcance }),
    ]);

    return buildPaginatedResponse(participants, total, filterDto);
  }

  /**
   * Buscar por ID.
   */
  async findOne(id: string, alcance: Alcance) {
    // `findFirst` con el alcance adentro del `where`, y no `findUnique` + un
    // chequeo posterior en JS: así la fila fuera de alcance ni siquiera sale de
    // Postgres, y no depende de que el `select` de mañana siga trayendo
    // `department`.
    const participant = await this.prisma.participant.findFirst({
      where: ScopeService.conAlcance(
        { id },
        this.scope.whereParticipant(alcance),
      ),
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
      // 404 y no 403, con el mismo mensaje que un id inexistente: un 403 le
      // confirmaría a quien prueba ids que ese participante existe, y de qué
      // departamento no es. Mismo criterio que R06.
      throw new NotFoundException('Participante no encontrado');
    }

    return participant;
  }

  /**
   * Buscar por DNI.
   */
  async findByDni(dni: string, alcance: Alcance) {
    const participant = await this.prisma.participant.findFirst({
      where: ScopeService.conAlcance(
        { dni },
        this.scope.whereParticipant(alcance),
      ),
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
    alcance: Alcance,
    actor?: JwtPayload,
  ) {
    // `findOne` ya aplica el alcance: editar un participante de otro
    // departamento devuelve 404 antes de tocar nada.
    const actual = await this.findOne(id, alcance);

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
    // -------------------------------------------------
    // S03 — el departamento tampoco es un campo más del PATCH
    // -------------------------------------------------
    //
    // El alta valida el departamento del body con `permiteDepartamento()`; la
    // edición no lo hacía, y `UpdateParticipantDto` hereda `department` vía
    // `PartialType`. Un delegado podía abrir un participante suyo —el `findOne`
    // de arriba lo deja pasar, es de su departamento— y escribirle otro:
    // la fila se mudaba al padrón ajeno con un 200.
    //
    // Es peor que el caso del alta que ya estaba cubierto: **saca** una fila de
    // una jurisdicción, y es de un solo sentido para quien lo hace, porque
    // después el `findOne` le devuelve 404 sobre la fila que acaba de mover y
    // no puede deshacerlo.
    //
    // Mismo criterio que el DNI: sólo se corta si el valor **cambia**, porque
    // los formularios mandan el objeto completo y rechazar un PATCH que reenvía
    // el mismo departamento rompería la edición de cualquier otro campo.
    const cambiaDepartamento =
      updateDto.department !== undefined &&
      updateDto.department !== actual.department;

    if (
      cambiaDepartamento &&
      !this.scope.permiteDepartamento(alcance, updateDto.department)
    ) {
      throw new ForbiddenException(
        'No podés mover un participante a un departamento fuera de tu alcance.',
      );
    }

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

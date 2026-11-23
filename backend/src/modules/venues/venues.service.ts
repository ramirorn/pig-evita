// ===========================================
// Venues Service
// ===========================================
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ScopeService } from '../../common/scope';
import type { Alcance } from '../../common/scope/scope.types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateVenueDto,
  UpdateVenueDto,
  VenueFilterDto,
  CAMPOS_ORDEN_VENUE,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';
import { MinioService } from '../documents/minio.service';
import { toVenueResponse } from './venue-image.util';

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Opcional: sólo se usa para borrar la foto cuando la sede se elimina de
    // verdad. Los specs que montan este service sin MinIO siguen andando.
    @Optional() private readonly minio?: MinioService,
    @Optional() private readonly scope?: ScopeService,
  ) {}

  /**
   * VULN-08: un admin territorial sólo gestiona sedes de su departamento o
   * zona. Controla la sede existente (si hay `id`) y el departamento al que
   * quedaría (alta o mudanza). Sin `alcance` (llamadas internas) no restringe.
   * Una sede inexistente sigue siendo 404, no 403.
   */
  async asegurarAlcance(
    alcance: Alcance | undefined,
    id?: string,
    departamentoNuevo?: string,
  ): Promise<void> {
    if (!alcance || alcance.tipo === 'PROVINCIAL') {
      if (id) await this.findOneRaw(id);
      return;
    }
    const fuera = (departamento?: string | null) =>
      !this.scope?.permiteDepartamento(alcance, departamento);
    if (id) {
      const actual = await this.findOneRaw(id);
      if (fuera(actual.department)) {
        throw new ForbiddenException(
          'Sólo podés gestionar sedes de tu territorio',
        );
      }
    }
    if (departamentoNuevo !== undefined && fuera(departamentoNuevo)) {
      throw new ForbiddenException(
        'Sólo podés gestionar sedes de tu territorio',
      );
    }
  }

  async create(createDto: CreateVenueDto, alcance?: Alcance) {
    await this.asegurarAlcance(alcance, undefined, createDto.department);
    const venue = await this.prisma.venue.create({
      data: createDto,
    });

    this.logger.log(`Venue created: ${venue.name} in ${venue.locality}`);
    return toVenueResponse(venue);
  }

  async findAll(filterDto: VenueFilterDto) {
    const where: Prisma.VenueWhereInput = {};

    if (filterDto.locality) {
      where.locality = { equals: filterDto.locality, mode: 'insensitive' };
    }

    if (filterDto.department) {
      where.department = { equals: filterDto.department, mode: 'insensitive' };
    }

    if (filterDto.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto.search) {
      where.name = { contains: filterDto.search, mode: 'insensitive' };
    }

    const [venues, total] = await Promise.all([
      this.prisma.venue.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_VENUE,
          'name',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.venue.count({ where }),
    ]);

    return buildPaginatedResponse(
      venues.map(toVenueResponse),
      total,
      filterDto,
    );
  }

  async findOne(id: string) {
    return toVenueResponse(await this.findOneRaw(id));
  }

  /** Sede con `imageKey` (uso interno: nunca devolverla tal cual). */
  private async findOneRaw(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: {
        _count: { select: { matches: true } },
      },
    });

    if (!venue) {
      throw new NotFoundException('Sede no encontrada');
    }

    return venue;
  }

  async update(id: string, updateDto: UpdateVenueDto, alcance?: Alcance) {
    // Verifica existencia y, para un admin territorial, que la sede (y el
    // departamento al que se mudaría) sean de su territorio.
    await this.asegurarAlcance(alcance, id, updateDto.department);

    const venue = await this.prisma.venue.update({
      where: { id },
      data: updateDto,
    });

    this.logger.log(`Venue updated: ${venue.name}`);
    return toVenueResponse(venue);
  }

  async remove(id: string, alcance?: Alcance) {
    await this.asegurarAlcance(alcance, id);
    const venue = await this.findOneRaw(id);

    // If venue has matches associated, soft delete by marking inactive
    if (venue._count && venue._count.matches > 0) {
      this.logger.log(
        `Venue ${venue.name} has matches, soft-deleting (deactivating)`,
      );
      return toVenueResponse(
        await this.prisma.venue.update({
          where: { id },
          data: { isActive: false },
        }),
      );
    }

    this.logger.log(`Venue deleted: ${venue.name}`);
    const eliminada = await this.prisma.venue.delete({
      where: { id },
    });

    // La sede ya no existe: su foto quedaría huérfana en el bucket. Se borra
    // después del DELETE (si la base falla, la foto sigue sirviendo) y en modo
    // best-effort: un objeto huérfano no justifica fallar la operación.
    if (venue.imageKey && this.minio) {
      await this.minio
        .deleteFile(venue.imageKey)
        .catch((error: Error) =>
          this.logger.warn(
            `No se pudo borrar la foto de la sede ${id}: ${error.message}`,
          ),
        );
    }

    return toVenueResponse(eliminada);
  }
}

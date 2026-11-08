// ===========================================
// Calendar Service
// ===========================================
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarFilterDto,
} from './dto';
import {
  buildPaginatedResponse,
  finDelRango,
  inicioDelRango,
} from '../../common/dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * F-15 — un evento no puede terminar antes de empezar. Se valida en el
   * service y no en el DTO porque en la edición uno de los dos extremos puede
   * venir de la fila guardada.
   */
  private validarRango(startDate: Date, endDate: Date | null) {
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }
  }

  /**
   * F-24 — la sede y la disciplina referenciadas tienen que existir. Sin esto
   * un UUID inexistente creaba el evento igual (o la FK reventaba en un 500).
   */
  private async validarReferencias(
    venueId?: string | null,
    disciplineId?: string | null,
  ) {
    if (venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
        select: { id: true },
      });
      if (!venue) throw new NotFoundException('La sede especificada no existe');
    }
    if (disciplineId) {
      const discipline = await this.prisma.discipline.findUnique({
        where: { id: disciplineId },
        select: { id: true },
      });
      if (!discipline) {
        throw new NotFoundException('La disciplina especificada no existe');
      }
    }
  }

  async create(createDto: CreateCalendarEventDto) {
    const startDate = new Date(createDto.startDate);
    const endDate = createDto.endDate ? new Date(createDto.endDate) : null;
    this.validarRango(startDate, endDate);
    await this.validarReferencias(createDto.venueId, createDto.disciplineId);

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: createDto.title,
        description: createDto.description || null,
        startDate,
        endDate,
        stage: createDto.stage || null,
        venueId: createDto.venueId || null,
        disciplineId: createDto.disciplineId || null,
        isPublished: createDto.isPublished ?? false,
      },
    });

    this.logger.log(`Calendar Event created: ${event.title}`);
    return event;
  }

  /**
   * Listado de eventos.
   *
   * `verBorradores` lo decide el controller según el rol. Cuando es `false`,
   * `isPublished: true` se impone después de leer el filtro del cliente: si no,
   * bastaba `?isPublished=false` para listar los eventos sin publicar.
   */
  async findAll(filterDto: CalendarFilterDto, verBorradores = false) {
    const where: Prisma.CalendarEventWhereInput = {};

    if (filterDto.isPublished !== undefined) {
      where.isPublished = filterDto.isPublished;
    }

    if (!verBorradores) {
      where.isPublished = true;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.startDate = {};
      if (filterDto.fromDate)
        where.startDate.gte = inicioDelRango(filterDto.fromDate);
      // F-18 — `toDate=YYYY-MM-DD` incluye el día completo.
      if (filterDto.toDate) where.startDate.lte = finDelRango(filterDto.toDate);
    }

    if (filterDto.search) {
      where.OR = [
        { title: { contains: filterDto.search, mode: 'insensitive' } },
        { description: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);

    return buildPaginatedResponse(events, total, filterDto);
  }

  /**
   * Evento por id.
   *
   * El endpoint es `@Public()` y hasta R06 no miraba `isPublished`: con el uuid
   * en la mano cualquiera leía un evento todavía no anunciado. Se filtra en el
   * `where` para que responda **404** en vez de confirmar que existe.
   */
  async findOne(id: string, verBorradores = false) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: verBorradores ? { id } : { id, isPublished: true },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    return event;
  }

  async update(id: string, updateDto: UpdateCalendarEventDto) {
    // `true`: el camino administrativo edita también eventos sin publicar.
    const actual = await this.findOne(id, true); // Verificar que existe

    // El rango se valida con lo que quedaría guardado: el PATCH puede traer
    // sólo uno de los dos extremos.
    const startDate =
      updateDto.startDate !== undefined
        ? new Date(updateDto.startDate)
        : actual.startDate;
    const endDate =
      updateDto.endDate !== undefined
        ? updateDto.endDate
          ? new Date(updateDto.endDate)
          : null
        : actual.endDate;
    this.validarRango(startDate, endDate);
    await this.validarReferencias(updateDto.venueId, updateDto.disciplineId);

    const updateData: Prisma.CalendarEventUpdateInput = {
      ...(updateDto.title !== undefined ? { title: updateDto.title } : {}),
      ...(updateDto.description !== undefined
        ? { description: updateDto.description || null }
        : {}),
      ...(updateDto.startDate !== undefined
        ? { startDate: new Date(updateDto.startDate) }
        : {}),
      ...(updateDto.endDate !== undefined
        ? { endDate: updateDto.endDate ? new Date(updateDto.endDate) : null }
        : {}),
      ...(updateDto.stage !== undefined
        ? { stage: updateDto.stage || null }
        : {}),
      ...(updateDto.venueId !== undefined
        ? { venueId: updateDto.venueId || null }
        : {}),
      ...(updateDto.disciplineId !== undefined
        ? { disciplineId: updateDto.disciplineId || null }
        : {}),
      ...(updateDto.isPublished !== undefined
        ? { isPublished: updateDto.isPublished }
        : {}),
    };

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Calendar Event updated: ${updated.title}`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id, true);
    const deleted = await this.prisma.calendarEvent.delete({
      where: { id },
    });
    this.logger.log(`Calendar Event deleted: ${deleted.title}`);
    return deleted;
  }
}

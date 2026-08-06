// ===========================================
// Calendar Service
// ===========================================
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  CalendarFilterDto,
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCalendarEventDto) {
    const event = await this.prisma.calendarEvent.create({
      data: {
        title: createDto.title,
        description: createDto.description || null,
        startDate: new Date(createDto.startDate),
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
        stage: createDto.stage || null,
        venueId: createDto.venueId || null,
        disciplineId: createDto.disciplineId || null,
        isPublished: createDto.isPublished ?? false,
      },
    });

    this.logger.log(`Calendar Event created: ${event.title}`);
    return event;
  }

  async findAll(filterDto: CalendarFilterDto) {
    const where: Prisma.CalendarEventWhereInput = {};

    if (filterDto.isPublished !== undefined) {
      where.isPublished = filterDto.isPublished;
    }

    if (filterDto.fromDate || filterDto.toDate) {
      where.startDate = {};
      if (filterDto.fromDate)
        where.startDate.gte = new Date(filterDto.fromDate);
      if (filterDto.toDate) where.startDate.lte = new Date(filterDto.toDate);
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

  async findOne(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    return event;
  }

  async update(id: string, updateDto: UpdateCalendarEventDto) {
    await this.findOne(id); // Verificar que existe

    const updateData: Prisma.CalendarEventUpdateInput = {
      ...(updateDto.title !== undefined ? { title: updateDto.title } : {}),
      ...(updateDto.description !== undefined ? { description: updateDto.description || null } : {}),
      ...(updateDto.startDate !== undefined ? { startDate: new Date(updateDto.startDate) } : {}),
      ...(updateDto.endDate !== undefined ? { endDate: updateDto.endDate ? new Date(updateDto.endDate) : null } : {}),
      ...(updateDto.stage !== undefined ? { stage: updateDto.stage || null } : {}),
      ...(updateDto.venueId !== undefined ? { venueId: updateDto.venueId || null } : {}),
      ...(updateDto.disciplineId !== undefined ? { disciplineId: updateDto.disciplineId || null } : {}),
      ...(updateDto.isPublished !== undefined ? { isPublished: updateDto.isPublished } : {}),
    };

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Calendar Event updated: ${updated.title}`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const deleted = await this.prisma.calendarEvent.delete({
      where: { id },
    });
    this.logger.log(`Calendar Event deleted: ${deleted.title}`);
    return deleted;
  }
}

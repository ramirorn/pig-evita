// ===========================================
// Venues Service
// ===========================================
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateVenueDto, UpdateVenueDto, VenueFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateVenueDto) {
    const venue = await this.prisma.venue.create({
      data: createDto,
    });

    this.logger.log(`Venue created: ${venue.name} in ${venue.locality}`);
    return venue;
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
        orderBy: { [filterDto.sortBy || 'name']: filterDto.sortOrder || 'asc' },
      }),
      this.prisma.venue.count({ where }),
    ]);

    return buildPaginatedResponse(venues, total, filterDto);
  }

  async findOne(id: string) {
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

  async update(id: string, updateDto: UpdateVenueDto) {
    await this.findOne(id); // verifica existencia

    const venue = await this.prisma.venue.update({
      where: { id },
      data: updateDto,
    });

    this.logger.log(`Venue updated: ${venue.name}`);
    return venue;
  }

  async remove(id: string) {
    const venue = await this.findOne(id);

    // If venue has matches associated, soft delete by marking inactive
    if (venue._count && venue._count.matches > 0) {
      this.logger.log(`Venue ${venue.name} has matches, soft-deleting (deactivating)`);
      return this.prisma.venue.update({
        where: { id },
        data: { isActive: false },
      });
    }

    this.logger.log(`Venue deleted: ${venue.name}`);
    return this.prisma.venue.delete({
      where: { id },
    });
  }
}

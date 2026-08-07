// ===========================================
// News Service
// ===========================================
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateNewsDto, UpdateNewsDto, NewsFilterDto } from './dto';
import { buildPaginatedResponse } from '../../common/dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  async create(createDto: CreateNewsDto, authorId: string) {
    const slug = this.generateSlug(createDto.title);

    // Evitar slugs duplicados
    const existing = await this.prisma.news.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const news = await this.prisma.news.create({
      data: {
        title: createDto.title,
        slug: finalSlug,
        content: createDto.content,
        excerpt: createDto.excerpt,
        imageKey: createDto.imageKey,
        isPublished: createDto.isPublished || false,
        publishedAt: createDto.isPublished ? new Date() : null,
        authorId,
      },
    });

    this.logger.log(`News created: ${news.title}`);
    return news;
  }

  async findAll(filterDto: NewsFilterDto) {
    const where: Prisma.NewsWhereInput = {};

    if (filterDto.isPublished !== undefined) {
      where.isPublished = filterDto.isPublished;
    }

    if (filterDto.search) {
      where.OR = [
        { title: { contains: filterDto.search, mode: 'insensitive' } },
        { excerpt: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const [newsList, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: {
          [filterDto.sortBy || 'createdAt']: filterDto.sortOrder || 'desc',
        },
      }),
      this.prisma.news.count({ where }),
    ]);

    return buildPaginatedResponse(newsList, total, filterDto);
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada');
    }

    return news;
  }

  async findBySlug(slug: string) {
    const news = await this.prisma.news.findUnique({
      where: { slug },
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada');
    }

    return news;
  }

  async update(id: string, updateDto: UpdateNewsDto) {
    const news = await this.findOne(id);

    const updateData: Prisma.NewsUpdateInput = { ...updateDto };

    // Si cambia el estado a publicado y no tenía fecha
    if (updateDto.isPublished && !news.publishedAt) {
      updateData.publishedAt = new Date();
    } else if (updateDto.isPublished === false) {
      updateData.publishedAt = null;
    }

    // Si cambia el título, actualizamos el slug
    if (updateDto.title && updateDto.title !== news.title) {
      let newSlug = this.generateSlug(updateDto.title);
      const existing = await this.prisma.news.findUnique({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
      updateData.slug = newSlug;
    }

    const updated = await this.prisma.news.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`News updated: ${updated.title}`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    const news = await this.prisma.news.delete({
      where: { id },
    });

    this.logger.log(`News deleted: ${news.title}`);
    return news;
  }
}

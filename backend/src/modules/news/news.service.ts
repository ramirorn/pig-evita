// ===========================================
// News Service
// ===========================================
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateNewsDto,
  UpdateNewsDto,
  NewsFilterDto,
  CAMPOS_ORDEN_NEWS,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';

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

  /**
   * Listado de noticias.
   *
   * `verBorradores` viene del controller: es `true` sólo para los roles que
   * administran contenido. Cuando es `false` el filtro `isPublished: true` se
   * impone al final, **pisando** lo que haya pedido el cliente: sin eso, un
   * anónimo listaba los borradores con sólo mandar `?isPublished=false`.
   */
  async findAll(filterDto: NewsFilterDto, verBorradores = false) {
    const where: Prisma.NewsWhereInput = {};

    if (filterDto.isPublished !== undefined) {
      where.isPublished = filterDto.isPublished;
    }

    if (!verBorradores) {
      where.isPublished = true;
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
        // R11 — el campo de orden se valida contra la whitelist antes de
        // llegar a Prisma; lo desconocido cae al default en vez de explotar.
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_NEWS,
          'createdAt',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
      }),
      this.prisma.news.count({ where }),
    ]);

    return buildPaginatedResponse(newsList, total, filterDto);
  }

  /**
   * Noticia por id.
   *
   * `findAll` filtraba por `isPublished` pero el acceso directo por id no, y el
   * endpoint es `@Public()`: conociendo el uuid se leía cualquier borrador sin
   * token (R06). El filtro va en el `where`, no en un `if` posterior, para que
   * el borrador devuelva **404** y no confirme siquiera que el id existe.
   */
  async findOne(id: string, verBorradores = false) {
    const news = await this.prisma.news.findFirst({
      where: verBorradores ? { id } : { id, isPublished: true },
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada');
    }

    return news;
  }

  /**
   * Noticia por slug. Mismo problema que `findOne`, y peor: el slug se deriva
   * del título con `generateSlug`, así que ni siquiera hacía falta conocer un
   * uuid para adivinar la URL de un borrador.
   */
  async findBySlug(slug: string, verBorradores = false) {
    const news = await this.prisma.news.findFirst({
      where: verBorradores ? { slug } : { slug, isPublished: true },
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada');
    }

    return news;
  }

  /**
   * S19 — una noticia externa no se edita ni se despublica como una propia.
   *
   * Lo que se ve aca es un **reflejo** de una nota que vive en
   * formosa.gob.ar: el titulo, la bajada y la imagen son los de alla, y el
   * link lleva alla. Dejar editarlos produciria una tarjeta que dice una cosa
   * y un destino que dice otra, con el agregado de que la proxima corrida del
   * sync pisaria la edicion sin avisar (el `upsert` es por `sourceUrl`).
   *
   * El borrado esta cerrado por el mismo motivo, y es el que menos se ve venir:
   * borrar la fila **no** saca la noticia, porque el sync la vuelve a crear en
   * la corrida siguiente. Un boton que promete "eliminar" y no elimina es peor
   * que no tener el boton. Si hay que dejar de mostrar una nota del portal, se
   * saca del portal, o se acota lo que el sync trae.
   */
  private rechazarSiEsExterna(
    news: { isExternal: boolean; sourceUrl: string | null },
    verbo: string,
  ): void {
    if (!news.isExternal) return;

    throw new ForbiddenException(
      `Esta noticia viene del portal oficial (${news.sourceUrl ?? 'formosa.gob.ar'}) y no se puede ${verbo} desde acá. ` +
        'Se sincroniza automáticamente: lo que se publique allá se refleja acá.',
    );
  }

  async update(id: string, updateDto: UpdateNewsDto) {
    // `true`: el camino administrativo tiene que poder editar un borrador.
    const news = await this.findOne(id, true);
    this.rechazarSiEsExterna(news, 'editar');

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
    const existente = await this.findOne(id, true);
    this.rechazarSiEsExterna(existente, 'eliminar');

    const news = await this.prisma.news.delete({
      where: { id },
    });

    this.logger.log(`News deleted: ${news.title}`);
    return news;
  }
}

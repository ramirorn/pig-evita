// ===========================================
// News Service
// ===========================================
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MinioService } from '../documents/minio.service';
import { borrarObjetoSinFallar } from '../images/image.util';
import {
  esImagenSubida,
  normalizarUrlDeImagen,
  toNewsResponse,
} from './news-image.util';
import {
  CreateNewsDto,
  UpdateNewsDto,
  NewsFilterDto,
  CAMPOS_ORDEN_NEWS,
} from './dto';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';

export const MSG_IMAGEN_EN_CONFLICTO =
  'La imagen de la noticia cambió mientras se procesaba el pedido. Volvé a intentarlo.';

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
 *
 * Exportada porque la imagen subida (`NewsImagesService`) sigue la misma regla.
 */
export function rechazarSiEsExterna(
  news: { isExternal: boolean; sourceUrl: string | null },
  verbo: string,
): void {
  if (!news.isExternal) return;

  throw new ForbiddenException(
    `Esta noticia viene del portal oficial (${news.sourceUrl ?? 'formosa.gob.ar'}) y no se puede ${verbo} desde acá. ` +
      'Se sincroniza automáticamente: lo que se publique allá se refleja acá.',
  );
}

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Opcional: sólo se usa para borrar la imagen SUBIDA cuando deja de usarse
    // (se reemplaza por una URL, se quita o se borra la noticia). Los specs
    // que montan este service sin MinIO siguen andando.
    @Optional() private readonly minio?: MinioService,
  ) {}

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
        // Sólo una URL externa: la imagen subida necesita el id y va después
        // por `POST /news/:id/image`.
        imageKey: normalizarUrlDeImagen(createDto.imageKey),
        isPublished: createDto.isPublished || false,
        publishedAt: createDto.isPublished ? new Date() : null,
        authorId,
      },
    });

    this.logger.log(`News created: ${news.title}`);
    return toNewsResponse(news);
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

    if (filterDto.isExternal !== undefined) {
      where.isExternal = filterDto.isExternal;
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
        orderBy: ordenDelListado(filterDto, verBorradores),
      }),
      this.prisma.news.count({ where }),
    ]);

    return buildPaginatedResponse(
      newsList.map((news) => toNewsResponse(news)),
      total,
      filterDto,
    );
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
    return toNewsResponse(await this.findOneRaw(id, verBorradores));
  }

  /** Noticia con `imageKey` (uso interno: nunca devolverla tal cual). */
  private async findOneRaw(id: string, verBorradores = false) {
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

    return toNewsResponse(news);
  }

  async update(id: string, updateDto: UpdateNewsDto) {
    // `true`: el camino administrativo tiene que poder editar un borrador.
    const news = await this.findOneRaw(id, true);
    rechazarSiEsExterna(news, 'editar');

    const { imageKey: imagenPedida, ...resto } = updateDto;
    const updateData: Prisma.NewsUpdateInput = { ...resto };

    // La imagen sólo se toca si vino en el body y cambia. Si la anterior era
    // un archivo SUBIDO, pasa a ser basura en el bucket: se borra al final.
    let cambiaImagen = false;
    if (imagenPedida !== undefined) {
      const nueva = normalizarUrlDeImagen(imagenPedida);
      if (nueva !== news.imageKey) {
        updateData.imageKey = nueva;
        cambiaImagen = true;
      }
    }

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

    let updated;
    try {
      updated = await this.prisma.news.update({
        // Condicional sobre la imagen leída: si una subida se cruzó en el
        // medio, no se la pisa (ni se borra su objeto) sin avisar.
        where: cambiaImagen ? { id, imageKey: news.imageKey } : { id },
        data: updateData,
      });
    } catch (error) {
      if (
        cambiaImagen &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(MSG_IMAGEN_EN_CONFLICTO);
      }
      throw error;
    }

    if (cambiaImagen && esImagenSubida(news.imageKey)) {
      await this.borrarImagenSubida(news.imageKey);
    }

    this.logger.log(`News updated: ${updated.title}`);
    return toNewsResponse(updated);
  }

  async remove(id: string) {
    const existente = await this.findOneRaw(id, true);
    rechazarSiEsExterna(existente, 'eliminar');

    const news = await this.prisma.news.delete({
      where: { id },
    });

    // La noticia ya no existe: su imagen subida quedaría huérfana. Se borra
    // después del DELETE y en modo best-effort, como la foto de una sede.
    if (esImagenSubida(news.imageKey)) {
      await this.borrarImagenSubida(news.imageKey);
    }

    this.logger.log(`News deleted: ${news.title}`);
    return toNewsResponse(news);
  }

  private async borrarImagenSubida(clave: string): Promise<void> {
    if (!this.minio) return;
    await borrarObjetoSinFallar(this.minio, clave, this.logger);
  }
}

/**
 * Orden del listado de noticias.
 *
 * Por defecto, **fecha de publicación descendente**. Antes era `createdAt`, que
 * para una nota del portal es el momento en que el sync la trajo: una nota de
 * hace un mes sincronizada hoy aparecía primera. `publishedAt` es la fecha real
 * en las dos clases de noticia (la del portal y la de publicación de una
 * propia).
 *
 * Desempates fijos (`createdAt`, `id`): varias notas del portal comparten fecha
 * —el portal sólo da el día—, y sin un desempate estable la paginación puede
 * repetir o saltear una nota entre página y página.
 *
 * Los borradores no tienen `publishedAt`. En el listado público no existen; en
 * el panel van **primero** (son trabajo en curso), y nunca al final de una
 * paginación donde no se los encuentra.
 *
 * R11 — el campo se valida contra la whitelist antes de llegar a Prisma; lo
 * desconocido cae al default en vez de explotar.
 */
export function ordenDelListado(
  filterDto: Pick<NewsFilterDto, 'sortBy' | 'sortOrder'>,
  verBorradores = false,
): Prisma.NewsOrderByWithRelationInput[] {
  const [[campo, direccion]] = Object.entries(
    buildOrderBy(
      CAMPOS_ORDEN_NEWS,
      'publishedAt',
      filterDto.sortBy,
      filterDto.sortOrder,
    ),
  );

  const principal: Prisma.NewsOrderByWithRelationInput =
    campo === 'publishedAt'
      ? {
          publishedAt: {
            sort: direccion,
            nulls: verBorradores && direccion === 'desc' ? 'first' : 'last',
          },
        }
      : { [campo]: direccion };

  const desempates: Prisma.NewsOrderByWithRelationInput[] =
    campo === 'createdAt'
      ? [{ id: 'desc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }];

  return [principal, ...desempates];
}

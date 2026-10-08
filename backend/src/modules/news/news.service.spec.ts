// ===========================================
// Orden del listado de noticias: por fecha de PUBLICACIÓN
// ===========================================
//
// El bug: el listado ordenaba por `createdAt`, que para una nota del portal es
// el momento en que el sync la trajo. Una nota de hace un mes sincronizada hoy
// salía primera en /noticias y en la portada, por delante de la de ayer.
import { plainToInstance } from 'class-transformer';
import { NewsService, ordenDelListado } from './news.service';
import { NewsFilterDto } from './dto';
import type { PrismaService } from '../../database/prisma.service';

function armar() {
  const findMany = jest.fn((_args: unknown) => Promise.resolve([]));
  const count = jest.fn((_args: unknown) => Promise.resolve(0));
  const prisma = { news: { findMany, count } } as unknown as PrismaService;
  return { service: new NewsService(prisma), findMany };
}

/** El DTO tal como lo arma el ValidationPipe a partir de la query string. */
const filtro = (query: Record<string, unknown> = {}) =>
  plainToInstance(NewsFilterDto, query);

describe('NewsService — orden del listado', () => {
  it('sin `sortBy`, el DTO ordena por fecha de publicación (no por la del sync)', () => {
    expect(filtro().sortBy).toBe('publishedAt');
  });

  it('el listado público ordena por publishedAt desc, con desempate estable', async () => {
    const { service, findMany } = armar();

    await service.findAll(filtro({ isPublished: true }), false);

    const args = findMany.mock.calls[0][0] as { orderBy: unknown };
    expect(args.orderBy).toEqual([
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('en el panel los borradores (sin publishedAt) van primero, no al fondo de la paginación', () => {
    expect(ordenDelListado(filtro(), true)[0]).toEqual({
      publishedAt: { sort: 'desc', nulls: 'first' },
    });
  });

  it('un orden explícito permitido se respeta, con los mismos desempates', () => {
    expect(
      ordenDelListado(filtro({ sortBy: 'title', sortOrder: 'asc' })),
    ).toEqual([{ title: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]);
    expect(ordenDelListado(filtro({ sortBy: 'createdAt' }))).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('un campo fuera de la whitelist cae al default (publishedAt), no llega a Prisma', () => {
    const orden = ordenDelListado({ sortBy: 'passwordHash', sortOrder: 'asc' });
    expect(orden[0]).toEqual({ publishedAt: { sort: 'asc', nulls: 'last' } });
    expect(JSON.stringify(orden)).not.toContain('passwordHash');
  });
});

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

describe('NewsService — orden por título en castellano (F-17)', () => {
  const fila = (id: string, title: string, createdAt: string) => ({
    id,
    title,
    createdAt: new Date(createdAt),
    imageKey: null,
  });
  const filas = [
    fila('1', 'Zeta', '2026-01-01T00:00:00Z'),
    fila('2', 'Árbol', '2026-01-02T00:00:00Z'),
    fila('3', 'alfa', '2026-01-03T00:00:00Z'),
    fila('4', 'Ñandú', '2026-01-04T00:00:00Z'),
    fila('5', 'Nube', '2026-01-05T00:00:00Z'),
  ];

  function armarConFilas() {
    const findMany = jest.fn((args: { where?: { id?: { in: string[] } } }) =>
      Promise.resolve(
        args.where?.id?.in
          ? filas.filter((f) => args.where!.id!.in.includes(f.id))
          : filas,
      ),
    );
    const prisma = { news: { findMany, count: jest.fn() } };
    return new NewsService(prisma as unknown as PrismaService);
  }

  const titulos = (r: { items: Array<{ title: string }> }) =>
    r.items.map((n) => n.title);

  it('"Á" va junto a "A" y "Ñ" después de "N", sin distinguir mayúsculas', async () => {
    const r = await armarConFilas().findAll(
      filtro({ sortBy: 'title', sortOrder: 'asc', limit: 50 }),
      true,
    );
    expect(titulos(r)).toEqual(['alfa', 'Árbol', 'Nube', 'Ñandú', 'Zeta']);
    expect(r.meta.total).toBe(5);
  });

  it('desc invierte el orden y la paginación corta sobre el orden ya resuelto', async () => {
    const r = await armarConFilas().findAll(
      filtro({ sortBy: 'title', sortOrder: 'desc', page: 2, limit: 2 }),
      true,
    );
    expect(titulos(r)).toEqual(['Nube', 'Árbol']);
    expect(r.meta.total).toBe(5);
  });
});

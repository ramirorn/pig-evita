// ===========================================
// E2E — Paginación de GET /audit (R03)
//
// El handler tipaba el `@Query()` como intersección
// (`PaginationQueryDto & { userId?: string; … }`). TypeScript **no emite
// metadata utilizable para un tipo intersección**: `design:paramtypes` queda en
// `Object`, así que el `ValidationPipe` global no tenía clase que instanciar.
// Consecuencia doble y en el mismo bug:
//
//   1. no validaba — `?limit=99999` devolvía 200 mientras `/users?limit=99999`
//      devolvía 400, o sea que la tabla más sensible del sistema era la única
//      sin tope;
//   2. no transformaba — `skip`/`take` son *getters* de la clase, y sobre un
//      objeto plano no existen: llegaban `undefined` y Prisma devolvía la
//      tabla entera.
//
// El test mira las dos puntas: el status que ve el cliente y los argumentos con
// los que se llamó a Prisma. La segunda es la que importa, porque un 200 con
// `take: undefined` se ve igual de bien desde afuera.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditController } from '../src/modules/audit/audit.controller';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/database/prisma.service';

/** Más filas que cualquier `limit` por defecto, para que el tope se note. */
const TOTAL_FILAS = 250;

const FILAS = Array.from({ length: TOTAL_FILAS }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  action: 'UPDATE',
  entity: 'participants',
  entityId: null,
  userId: null,
  changes: null,
  ip: '203.0.113.10',
  userAgent: 'EvitaTest/1.0',
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  user: null,
}));

describe('Paginación de GET /audit (e2e)', () => {
  let app: INestApplication<App>;
  let findMany: jest.Mock;

  /** Los argumentos con los que el service llamó a Prisma en el último request. */
  const ultimaLlamada = () =>
    findMany.mock.calls[findMany.mock.calls.length - 1]?.[0] as {
      skip?: number;
      take?: number;
    };

  beforeEach(async () => {
    // Honra `skip`/`take` como lo haría Prisma: si llegan `undefined`, devuelve
    // **todo**. Un mock que paginara por su cuenta escondería justamente el bug.
    findMany = jest.fn(({ skip, take }: { skip?: number; take?: number }) =>
      Promise.resolve(
        take === undefined
          ? FILAS.slice(skip ?? 0)
          : FILAS.slice(skip ?? 0, (skip ?? 0) + take),
      ),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              findMany,
              count: jest.fn().mockResolvedValue(TOTAL_FILAS),
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Misma configuración que `main.ts`: el bug sólo se manifiesta con este
    // pipe puesto, porque es el que decide si hay DTO que instanciar.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------
  // El DoD literal
  // -------------------------------------------------
  it('?limit=99999 devuelve 400, igual que el resto de los listados', async () => {
    await request(app.getHttpServer()).get('/audit?limit=99999').expect(400);
  });

  it('el 400 nombra el tope, para que el cliente sepa qué corregir', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit?limit=99999')
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/limit/i);
  });

  it('sin parámetros no devuelve más que el limit por defecto', async () => {
    const res = await request(app.getHttpServer()).get('/audit').expect(200);

    // Con el bug, acá venían las 250 filas.
    expect(res.body.items).toHaveLength(20);
    expect(res.body.meta.total).toBe(TOTAL_FILAS);
  });

  // -------------------------------------------------
  // La punta que un 200 solo no distingue
  // -------------------------------------------------
  it('el DTO se instancia: `skip` y `take` llegan a Prisma como números', async () => {
    await request(app.getHttpServer()).get('/audit').expect(200);

    // `skip`/`take` son getters de `PaginationQueryDto`. Si el pipe no
    // instancia la clase, el objeto plano no los tiene y viajan `undefined`,
    // que en Prisma significa "sin límite".
    expect(ultimaLlamada()).toMatchObject({ skip: 0, take: 20 });
    expect(ultimaLlamada().take).not.toBeUndefined();
  });

  it('respeta page y limit válidos', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit?page=3&limit=50')
      .expect(200);

    expect(ultimaLlamada()).toMatchObject({ skip: 100, take: 50 });
    expect(res.body.items).toHaveLength(50);
  });

  it('acepta el tope exacto de 100', async () => {
    await request(app.getHttpServer()).get('/audit?limit=100').expect(200);

    expect(ultimaLlamada()).toMatchObject({ take: 100 });
  });

  // -------------------------------------------------
  // El resto del DTO también tiene que validar
  // -------------------------------------------------
  it.each([
    ['limit por debajo del mínimo', '?limit=0'],
    ['page negativa', '?page=-1'],
    ['userId que no es uuid', '?userId=no-es-uuid'],
    ['entityId que no es uuid', '?entityId=1'],
    ['fecha con formato inválido', '?fromDate=ayer'],
    ['parámetro desconocido', '?loQueSea=1'],
  ])('rechaza %s con 400', async (_caso, query) => {
    await request(app.getHttpServer()).get(`/audit${query}`).expect(400);
  });

  it('los filtros legítimos siguen funcionando', async () => {
    await request(app.getHttpServer())
      .get('/audit?action=UPDATE&entity=participants&limit=5')
      .expect(200);

    expect(ultimaLlamada()).toMatchObject({ take: 5 });
  });
});

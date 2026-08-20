// ===========================================
// E2E — GET /dashboard/stats consolidado + cache Redis (T22 / Q3)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * `ioredis` se mockea a nivel de módulo para que la suite no abra un socket
 * real: sin Docker no hay Redis, y un cliente que reintenta contra
 * localhost:6379 deja handles colgados y ensucia la salida.
 *
 * El doble arranca "caído" (`status: 'end'`), que es justamente el escenario de
 * degradación elegante. Los tests que quieren probar el cache le ponen
 * `status = 'ready'` a la instancia creada.
 */
class FakeRedis {
  static ultimaInstancia: FakeRedis | null = null;

  status = 'end';
  almacen = new Map<string, string>();
  get = jest.fn((clave: string) =>
    Promise.resolve(this.almacen.get(clave) ?? null),
  );
  setex = jest.fn((clave: string, _ttl: number, valor: string) => {
    this.almacen.set(clave, valor);
    return Promise.resolve('OK');
  });
  on = jest.fn();
  connect = jest.fn(() => Promise.resolve());
  disconnect = jest.fn();

  constructor() {
    FakeRedis.ultimaInstancia = this;
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => new FakeRedis()),
}));

import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/database/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors';

/** Fila cruda de `inscription.findMany` tal como la devolvería Prisma sin select. */
function inscripcionCompleta(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    participantId: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    categoryId: '20000000-0000-4000-8000-000000000001',
    teamId: null,
    createdById: null,
    status: 'PENDIENTE',
    qrCode: `EVITA-${String(i).padStart(8, '0')}`,
    notes: 'Nota interna del revisor sobre la documentación presentada.',
    reviewedById: null,
    reviewedAt: null,
    approvedById: null,
    approvedAt: null,
    rejectionNote: 'Falta certificado médico vigente.',
    createdAt: new Date(`2026-03-0${i + 1}T12:00:00.000Z`),
    updatedAt: new Date(`2026-03-0${i + 1}T12:00:00.000Z`),
    participant: {
      id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      dni: `4512${String(i).padStart(4, '0')}`,
      firstName: 'Juan',
      lastName: 'Pérez',
      birthDate: new Date('2010-05-15T00:00:00.000Z'),
      sex: 'MASCULINO',
      phone: '3704123456',
      email: 'juan.perez@example.com',
      locality: 'Clorinda',
      department: 'Pilcomayo',
      address: 'Av. San Martín 1234',
    },
    category: {
      id: '20000000-0000-4000-8000-000000000001',
      disciplineId: '50000000-0000-4000-8000-000000000001',
      name: 'Sub-14 Masculino',
      sex: 'MASCULINO',
      minAge: 12,
      maxAge: 14,
      isActive: true,
      sortOrder: 1,
    },
  };
}

/** Aplica un `select` de Prisma (con anidados) sobre una fila. */
function aplicarSelect(fila: any, select: any): any {
  if (fila === null || fila === undefined) return fila;
  if (Array.isArray(fila)) return fila.map((f) => aplicarSelect(f, select));

  const salida: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(select)) {
    if (valor === true) {
      salida[campo] = fila[campo];
    } else if (valor && typeof valor === 'object' && 'select' in valor) {
      salida[campo] = aplicarSelect(fila[campo], (valor as any).select);
    }
  }
  return salida;
}

describe('GET /dashboard/stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: any;
  /** Cuenta cuántas veces se tocó la base, para probar el cache. */
  let golpesDb: () => number;

  /**
   * @param inscriptionGroups filas que devuelve `inscription.groupBy`. Por
   * defecto sólo PENDIENTE, para probar el relleno de los estados faltantes.
   */
  async function levantarApp(
    inscriptionGroups: Array<{ status: string; _count: { status: number } }> = [
      { status: 'PENDIENTE', _count: { status: 3 } },
    ],
  ) {
    let llamadas = 0;
    const contar = <T>(valor: T) =>
      jest.fn(() => {
        llamadas++;
        return Promise.resolve(valor);
      });
    golpesDb = () => llamadas;

    prisma = {
      participant: {
        count: contar(1240),
        groupBy: contar([
          { sex: 'MASCULINO', _count: { sex: 700 } },
          { sex: 'FEMENINO', _count: { sex: 540 } },
        ]),
      },
      team: { count: contar(87) },
      competition: { count: contar(14) },
      inscription: {
        count: contar(1502),
        groupBy: contar(inscriptionGroups),
        findMany: jest.fn(({ select, take }: any) => {
          llamadas++;
          return Promise.resolve(
            Array.from({ length: take }, (_, i) =>
              aplicarSelect(inscripcionCompleta(i), select),
            ),
          );
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: (_k: string, def?: unknown) => def },
        },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  }

  afterEach(async () => {
    if (app) await app.close();
    FakeRedis.ultimaInstancia = null;
    jest.clearAllMocks();
  });

  describe('sin Redis disponible (degradación elegante)', () => {
    it('responde igual, calculando contra la base', async () => {
      await levantarApp();
      // El doble arranca con status 'end': el service no debería usarlo.
      expect(FakeRedis.ultimaInstancia!.status).toBe('end');

      const res = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalParticipants).toBe(1240);
      expect(res.body.data.totalTeams).toBe(87);
      expect(res.body.data.totalInscriptions).toBe(1502);
      expect(res.body.data.totalCompetitions).toBe(14);
      expect(FakeRedis.ultimaInstancia!.get).not.toHaveBeenCalled();
      expect(FakeRedis.ultimaInstancia!.setex).not.toHaveBeenCalled();
    });

    it('sin cache, cada request recalcula (línea de base del test de cache)', async () => {
      await levantarApp();
      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);
      const primeraTanda = golpesDb();

      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);
      expect(golpesDb()).toBe(primeraTanda * 2);
    });
  });

  describe('un solo request reemplaza a los 8 del dashboard', () => {
    it('trae contadores, conteo por estado y últimas inscripciones juntos', async () => {
      await levantarApp();
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      const d = body.data;
      expect(Object.keys(d).sort()).toEqual([
        'demographics',
        'inscriptionsByStatus',
        'lastUpdated',
        'recentInscriptions',
        'totalCompetitions',
        'totalInscriptions',
        'totalParticipants',
        'totalTeams',
      ]);
      expect(d.recentInscriptions).toHaveLength(5);
      expect(typeof d.lastUpdated).toBe('string');
    });

    it('las 7 consultas salen en paralelo, no en cascada', async () => {
      // Cada consulta resuelve recién cuando se destraba `soltar`. Si el service
      // las encadenara, la primera nunca terminaría y el request colgaría.
      await levantarApp();
      let soltar!: () => void;
      const compuerta = new Promise<void>((r) => (soltar = r));
      const enEspera: string[] = [];

      const demorar = (nombre: string, valor: unknown) => (args?: any) =>
        compuerta.then(() => {
          enEspera.push(nombre);
          return typeof valor === 'function' ? (valor as any)(args) : valor;
        });

      prisma.participant.count = jest.fn(demorar('participants', 1240));
      prisma.team.count = jest.fn(demorar('teams', 87));
      prisma.inscription.count = jest.fn(demorar('inscriptions', 1502));
      prisma.competition.count = jest.fn(demorar('competitions', 14));

      // `.then()` dispara el envío: supertest es perezoso y sin esto el
      // request no sale hasta que se lo espera.
      const pedido = request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200)
        .then((r) => r);

      // Esperamos a que el handler arranque (el request viaja por HTTP real) y
      // recién ahí miramos: con las 4 disparadas y ninguna resuelta, la única
      // explicación es que salieron en paralelo.
      const arrancaron = () =>
        prisma.participant.count.mock.calls.length > 0 &&
        prisma.team.count.mock.calls.length > 0 &&
        prisma.inscription.count.mock.calls.length > 0 &&
        prisma.competition.count.mock.calls.length > 0;
      for (let i = 0; i < 200 && !arrancaron(); i++) {
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(arrancaron()).toBe(true);
      expect(enEspera).toHaveLength(0);

      soltar();
      await pedido;
      expect(enEspera).toHaveLength(4);
    });
  });

  describe('inscriptionsByStatus', () => {
    it('devuelve los 4 estados aunque groupBy sólo traiga uno', async () => {
      await levantarApp([{ status: 'PENDIENTE', _count: { status: 3 } }]);
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(body.data.inscriptionsByStatus).toEqual([
        { status: 'PENDIENTE', count: 3 },
        { status: 'REVISADA', count: 0 },
        { status: 'APROBADA', count: 0 },
        { status: 'RECHAZADA', count: 0 },
      ]);
    });

    it('devuelve los 4 estados con 0 cuando no hay ninguna inscripción', async () => {
      await levantarApp([]);
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(body.data.inscriptionsByStatus).toEqual([
        { status: 'PENDIENTE', count: 0 },
        { status: 'REVISADA', count: 0 },
        { status: 'APROBADA', count: 0 },
        { status: 'RECHAZADA', count: 0 },
      ]);
    });

    it('respeta el orden fijo aunque groupBy los devuelva desordenados', async () => {
      await levantarApp([
        { status: 'RECHAZADA', _count: { status: 4 } },
        { status: 'APROBADA', _count: { status: 9 } },
        { status: 'PENDIENTE', _count: { status: 2 } },
        { status: 'REVISADA', _count: { status: 7 } },
      ]);
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(body.data.inscriptionsByStatus.map((s: any) => s.status)).toEqual([
        'PENDIENTE',
        'REVISADA',
        'APROBADA',
        'RECHAZADA',
      ]);
      expect(body.data.inscriptionsByStatus).toContainEqual({
        status: 'APROBADA',
        count: 9,
      });
    });

    it('usa un solo groupBy, no una query por estado', async () => {
      await levantarApp();
      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);
      expect(prisma.inscription.groupBy).toHaveBeenCalledTimes(1);
      // El bug original: 4 `count` con filtro de status, uno por estado.
      expect(prisma.inscription.count).toHaveBeenCalledTimes(1);
      expect(prisma.inscription.count).toHaveBeenCalledWith();
    });
  });

  describe('recentInscriptions', () => {
    it('trae las 5 más recientes con lo que muestra el widget', async () => {
      await levantarApp();
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(prisma.inscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      );

      const fila = body.data.recentInscriptions[0];
      expect(fila.id).toEqual(expect.any(String));
      expect(fila.qrCode).toBe('EVITA-00000000');
      expect(fila.status).toBe('PENDIENTE');
      expect(fila.createdAt).toBe('2026-03-01T12:00:00.000Z');
      expect(fila.participant).toEqual({
        id: expect.any(String),
        firstName: 'Juan',
        lastName: 'Pérez',
      });
      expect(fila.category).toEqual({
        id: expect.any(String),
        name: 'Sub-14 Masculino',
      });
    });

    it('no filtra DNI, contacto ni notas internas', async () => {
      await levantarApp();
      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      const crudo = JSON.stringify(body.data.recentInscriptions);
      for (const fila of body.data.recentInscriptions) {
        expect(fila.notes).toBeUndefined();
        expect(fila.rejectionNote).toBeUndefined();
        expect(fila.participant.dni).toBeUndefined();
        expect(fila.participant.email).toBeUndefined();
        expect(fila.participant.phone).toBeUndefined();
        expect(fila.participant.address).toBeUndefined();
        expect(fila.participant.birthDate).toBeUndefined();
      }
      // Red de seguridad: ni siquiera los valores aparecen en el payload.
      expect(crudo).not.toContain('4512');
      expect(crudo).not.toContain('juan.perez@example.com');
      expect(crudo).not.toContain('Nota interna');
      expect(crudo).not.toContain('certificado médico');
    });

    it('usa select y no include (no arrastra columnas nuevas)', async () => {
      await levantarApp();
      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);

      const args = prisma.inscription.findMany.mock.calls[0][0];
      expect(args.include).toBeUndefined();
      expect(args.select).toBeDefined();
      expect(args.select.participant.select).toEqual({
        id: true,
        firstName: true,
        lastName: true,
      });
    });
  });

  describe('cache Redis', () => {
    /** Pone el doble en estado `ready` para simular que Redis sí está. */
    function conectarRedis() {
      FakeRedis.ultimaInstancia!.status = 'ready';
      return FakeRedis.ultimaInstancia!;
    }

    it('la segunda llamada se sirve del cache y no toca la base', async () => {
      await levantarApp();
      const redis = conectarRedis();

      const primera = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);
      const golpesTrasPrimera = golpesDb();
      expect(golpesTrasPrimera).toBeGreaterThan(0);
      expect(redis.setex).toHaveBeenCalledTimes(1);

      const segunda = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(golpesDb()).toBe(golpesTrasPrimera);
      expect(segunda.body.data).toEqual(primera.body.data);
    });

    it('guarda con TTL de 60s bajo una única clave global', async () => {
      await levantarApp();
      const redis = conectarRedis();
      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);

      expect(redis.setex).toHaveBeenCalledWith(
        'dashboard:stats',
        60,
        expect.any(String),
      );
    });

    it('si Redis falla al leer, cae a la base en vez de romper', async () => {
      await levantarApp();
      const redis = conectarRedis();
      redis.get.mockRejectedValueOnce(new Error('READONLY'));

      const { body } = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      expect(body.data.totalParticipants).toBe(1240);
      expect(golpesDb()).toBeGreaterThan(0);
    });

    it('si Redis falla al escribir, la respuesta sale igual', async () => {
      await levantarApp();
      const redis = conectarRedis();
      redis.setex.mockRejectedValueOnce(new Error('OOM'));

      await request(app.getHttpServer()).get('/dashboard/stats').expect(200);
    });

    it('la respuesta cacheada tiene la misma forma que la recién calculada', async () => {
      await levantarApp();
      conectarRedis();

      const primera = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);
      const segunda = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .expect(200);

      // `createdAt` normalizado a ISO: idéntico venga de Prisma (Date) o de
      // Redis (string ya serializado).
      expect(segunda.body.data.recentInscriptions[0].createdAt).toBe(
        primera.body.data.recentInscriptions[0].createdAt,
      );
      expect(segunda.body.data.lastUpdated).toBe(primera.body.data.lastUpdated);
    });
  });
});

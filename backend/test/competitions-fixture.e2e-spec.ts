// ===========================================
// E2E — Competencias y generación de fixture (auditoría funcional)
// ===========================================
//
// No existía ningún e2e de `POST /competitions` ni de
// `POST /competitions/:id/fixture`. Se usa el motor real (`EngineFactory` +
// `RoundRobinEngine`) sobre un Prisma en memoria.
//
// `it.failing` = defecto conocido (F-09, F-13, F-14 de
// documentacion/auditoria-funcional.md) afirmando el comportamiento correcto.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { CompetitionsController } from '../src/modules/competitions/competitions.controller';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import {
  EngineFactory,
  RoundRobinEngine,
} from '../src/modules/competitions/engine.factory';
import { PrismaService } from '../src/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import {
  TransformInterceptor,
  CacheControlInterceptor,
} from '../src/common/interceptors';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const DISC = '11111111-1111-4111-8111-111111111111';
const CAT = '22222222-2222-4222-8222-222222222222';
const COMP = '33333333-3333-4333-8333-333333333333';
const uuid = (n: number) =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`;

interface Comp {
  id: string;
  disciplineId: string;
  categoryId: string;
  stage: string;
  format: string;
  status: string;
}

describe('Competencias y fixture (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let comps: Map<string, Comp>;
  let matches: Array<{ id: string; competitionId: string; round: number }>;
  let results: Array<{ matchId: string; participantId?: string; teamId?: string }>;

  const token = (role: Role) =>
    jwt.sign({ sub: `user-${role}`, email: `${role}@t.test`, role, type: 'access' });
  const auth = (role: Role) => ({ Authorization: `Bearer ${token(role)}` });

  beforeEach(async () => {
    comps = new Map();
    matches = [];
    results = [];
    let n = 0;

    const prisma = {
      competition: {
        findUnique: jest.fn(
          (args: {
            where: { id?: string; disciplineId_categoryId_stage?: Record<string, string> };
          }) => {
            if (args.where.id) {
              const c = comps.get(args.where.id);
              if (!c) return Promise.resolve(null);
              return Promise.resolve({
                ...c,
                matches: matches
                  .filter((m) => m.competitionId === c.id)
                  .map((m) => ({
                    ...m,
                    results: results.filter((r) => r.matchId === m.id),
                  })),
              });
            }
            const k = args.where.disciplineId_categoryId_stage!;
            return Promise.resolve(
              [...comps.values()].find(
                (c) =>
                  c.disciplineId === k.disciplineId &&
                  c.categoryId === k.categoryId &&
                  c.stage === k.stage,
              ) ?? null,
            );
          },
        ),
        create: jest.fn((args: { data: Omit<Comp, 'id' | 'status'> }) => {
          const c: Comp = { id: COMP, status: 'BORRADOR', ...args.data };
          comps.set(c.id, c);
          return Promise.resolve(c);
        }),
        update: jest.fn((args: { where: { id: string }; data: Partial<Comp> }) => {
          Object.assign(comps.get(args.where.id)!, args.data);
          return Promise.resolve(comps.get(args.where.id));
        }),
      },
      category: {
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(
            args.where.id === CAT ? { id: CAT, disciplineId: DISC } : null,
          ),
        ),
      },
      match: {
        create: jest.fn((args: { data: { competitionId: string; round: number } }) => {
          const m = { id: `m-${++n}`, ...args.data };
          matches.push(m);
          return Promise.resolve(m);
        }),
      },
      result: {
        createMany: jest.fn(
          (args: { data: Array<{ matchId: string; participantId?: string; teamId?: string }> }) => {
            results.push(...args.data);
            return Promise.resolve({ count: args.data.length });
          },
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [CompetitionsController],
      providers: [
        CompetitionsService,
        EngineFactory,
        RoundRobinEngine,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => CONFIG[k]) } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    jwt = moduleFixture.get(JwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const crear = (over: Record<string, unknown> = {}, rol: Role = Role.ADMIN_PROVINCIAL) =>
    request(app.getHttpServer())
      .post('/competitions')
      .set(auth(rol))
      .send({
        disciplineId: DISC,
        categoryId: CAT,
        stage: 'ZONAL',
        format: 'ROUND_ROBIN',
        ...over,
      });
  const fixture = (body: unknown, rol: Role = Role.ADMIN_PROVINCIAL) =>
    request(app.getHttpServer())
      .post(`/competitions/${COMP}/fixture`)
      .set(auth(rol))
      .send(body as object);

  describe('alta', () => {
    it('crea en BORRADOR', async () => {
      const res = await crear().expect(201);
      expect(res.body.data.status).toBe('BORRADOR');
    });

    it.each([Role.DELEGADO, Role.ARBITRO, Role.COORDINADOR])(
      '%s no puede crear → 403',
      async (rol) => {
        await crear({}, rol).expect(403);
      },
    );

    it.each([
      [{ stage: 'MUNDIAL' }],
      [{ format: 'LIGA' }],
      [{ disciplineId: 'x' }],
      [{ categoryId: 'x' }],
      [{ extra: 1 }],
    ])('payload inválido %j → 400', async (mal) => {
      await crear(mal).expect(400);
    });

    it('duplicado disciplina+categoría+etapa → 409', async () => {
      await crear().expect(201);
      await crear().expect(409);
    });

    it('categoría de otra disciplina → 400', async () => {
      await crear({ categoryId: '99999999-9999-4999-8999-999999999999' }).expect(400);
    });
  });

  describe('fixture round robin', () => {
    beforeEach(async () => {
      await crear().expect(201);
    });

    it.each([2, 3, 4, 5, 8])(
      '%i competidores → todos contra todos exactamente una vez',
      async (n) => {
        const ids = Array.from({ length: n }, (_, i) => uuid(i + 1));
        await fixture({ participantIds: ids }).expect(201);
        const pares = new Set<string>();
        for (const m of matches) {
          const par = results
            .filter((r) => r.matchId === m.id)
            .map((r) => r.participantId)
            .sort()
            .join('|');
          expect(pares.has(par)).toBe(false);
          pares.add(par);
        }
        expect(matches).toHaveLength((n * (n - 1)) / 2);
        expect(comps.get(COMP)!.status).toBe('ACTIVA');
      },
    );

    it('un competidor nunca juega dos veces en la misma ronda', async () => {
      const ids = Array.from({ length: 6 }, (_, i) => uuid(i + 1));
      await fixture({ participantIds: ids }).expect(201);
      const porRonda = new Map<number, string[]>();
      for (const m of matches) {
        const jugadores = results.filter((r) => r.matchId === m.id).map((r) => r.participantId!);
        porRonda.set(m.round, [...(porRonda.get(m.round) ?? []), ...jugadores]);
      }
      for (const [, jugadores] of porRonda) {
        expect(new Set(jugadores).size).toBe(jugadores.length);
      }
    });

    it('por equipos usa teamId', async () => {
      await fixture({ teamIds: [uuid(1), uuid(2), uuid(3)] }).expect(201);
      expect(results.every((r) => r.teamId && !r.participantId)).toBe(true);
    });

    it('menos de 2 ids → 400; segundo fixture → 409; DELEGADO → 403', async () => {
      await fixture({ participantIds: [uuid(1)] }).expect(400);
      await fixture({}).expect(400);
      await fixture({ participantIds: [uuid(1), uuid(2)] }, Role.DELEGADO).expect(403);
      await fixture({ participantIds: [uuid(1), uuid(2)] }).expect(201);
      await fixture({ participantIds: [uuid(1), uuid(2)] }).expect(409);
    });

    it('ids que no son UUID → 400', async () => {
      await fixture({ participantIds: ['a', 'b'] }).expect(400);
    });

    it.failing(
      'F-13: el mismo id repetido debería rechazarse con 400 (un competidor no juega contra sí mismo)',
      async () => {
        await fixture({ participantIds: [uuid(1), uuid(1)] }).expect(400);
      },
    );
  });

  describe('otros formatos', () => {
    it.failing.each(['ELIMINACION_DIRECTA', 'FASE_GRUPOS'])(
      'F-14: el formato %s se ofrece en el alta pero generar el fixture responde 501',
      async (format) => {
        await crear({ format }).expect(201);
        await fixture({ participantIds: [uuid(1), uuid(2), uuid(3), uuid(4)] }).expect(201);
      },
    );
  });

  describe('admisión al fixture', () => {
    it.failing(
      'F-09: sólo participantes con inscripción APROBADA deberían entrar al fixture (CA-C1.3)',
      async () => {
        await crear().expect(201);
        // El motor no consulta inscripciones en absoluto: con ids cualesquiera genera partidos.
        await fixture({ participantIds: [uuid(1), uuid(2)] }).expect(400);
      },
    );
  });
});

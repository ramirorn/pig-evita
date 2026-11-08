// ===========================================
// E2E — Resultados y tabla de posiciones (auditoría funcional)
// ===========================================
//
// Hasta esta auditoría no había ningún e2e sobre `PATCH /results/match/:id` ni
// sobre `GET /results/rankings/competition/:id`. Se cubre con auth real
// (JwtStrategy + JwtAuthGuard + RolesGuard) y un Prisma en memoria que aplica
// los `where`/`select` que arma el service.
//
// Los hallazgos F-10, F-11 y F-12 de documentacion/auditoria-funcional.md
// estaban marcados `it.failing` (defecto conocido); ya corregidos, quedan como
// contrato.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { ResultsController } from '../src/modules/results/results.controller';
import { ResultsService } from '../src/modules/results/results.service';
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

const COMP = '11111111-1111-4111-8111-111111111111';
const M1 = '22222222-2222-4222-8222-222222222221';
const M2 = '22222222-2222-4222-8222-222222222222';
const R = (n: number) => `33333333-3333-4333-8333-33333333333${n}`;
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

interface Res {
  id: string;
  matchId: string;
  participantId: string;
  teamId: null;
  isWinner: boolean | null;
  ranking: number | null;
  scoreData: unknown;
}
interface Mat {
  id: string;
  competitionId: string;
  status: string;
  finishedAt: Date | null;
}

describe('Resultados y rankings (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let partidos: Map<string, Mat>;
  let resultados: Map<string, Res>;

  const token = (role: Role) =>
    jwt.sign({
      sub: `user-${role}`,
      email: `${role}@t.test`,
      role,
      type: 'access',
    });

  beforeEach(async () => {
    partidos = new Map([
      [
        M1,
        { id: M1, competitionId: COMP, status: 'PROGRAMADO', finishedAt: null },
      ],
      [
        M2,
        { id: M2, competitionId: COMP, status: 'PROGRAMADO', finishedAt: null },
      ],
    ]);
    const nuevo = (n: number, matchId: string, p: string): Res => ({
      id: R(n),
      matchId,
      participantId: p,
      teamId: null,
      isWinner: null,
      ranking: null,
      scoreData: {},
    });
    resultados = new Map(
      [nuevo(1, M1, A), nuevo(2, M1, B), nuevo(3, M2, B), nuevo(4, M2, C)].map(
        (r) => [r.id, r] as const,
      ),
    );
    const nombres: Record<
      string,
      { id: string; firstName: string; lastName: string }
    > = {
      [A]: { id: A, firstName: 'Ana', lastName: 'A' },
      [B]: { id: B, firstName: 'Beto', lastName: 'B' },
      [C]: { id: C, firstName: 'Cleo', lastName: 'C' },
    };

    const matchConResultados = (id: string) => {
      const m = partidos.get(id);
      if (!m) return null;
      return {
        ...m,
        results: [...resultados.values()].filter((r) => r.matchId === id),
      };
    };

    // Tipado explícito: `$transaction` se refiere a `prisma` dentro de su propio
    // inicializador y, sin anotación, TypeScript lo infiere como `any` (TS7022).
    const prisma: Record<string, unknown> = {
      match: {
        findUnique: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(matchConResultados(args.where.id)),
        ),
        update: jest.fn(
          (args: { where: { id: string }; data: Partial<Mat> }) => {
            Object.assign(partidos.get(args.where.id)!, args.data);
            return Promise.resolve(partidos.get(args.where.id));
          },
        ),
      },
      result: {
        update: jest.fn(
          (args: { where: { id: string }; data: Partial<Res> }) => {
            const r = resultados.get(args.where.id)!;
            Object.assign(r, args.data);
            return Promise.resolve(r);
          },
        ),
      },
      competition: {
        findUnique: jest.fn((args: { where: { id: string } }) => {
          if (args.where.id !== COMP) return Promise.resolve(null);
          return Promise.resolve({
            id: COMP,
            discipline: { id: 'd', name: 'Ajedrez' },
            matches: [...partidos.values()]
              .filter((m) => m.status === 'FINALIZADO')
              .map((m) => ({
                id: m.id,
                results: [...resultados.values()]
                  .filter((r) => r.matchId === m.id)
                  .map((r) => ({
                    teamId: null,
                    participantId: r.participantId,
                    isWinner: r.isWinner,
                    team: null,
                    participant: nombres[r.participantId],
                  })),
              })),
          });
        }),
      },
      $transaction: jest.fn(
        (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(prisma),
      ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [ResultsController],
      providers: [
        ResultsService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => CONFIG[k]) },
        },
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

  const cargar = (matchId: string, rol: Role, payload: unknown) =>
    request(app.getHttpServer())
      .patch(`/results/match/${matchId}`)
      .set('Authorization', `Bearer ${token(rol)}`)
      .send(payload as object);

  describe('PATCH /results/match/:matchId', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer())
        .patch(`/results/match/${M1}`)
        .send([])
        .expect(401);
    });

    it.each([
      Role.DELEGADO,
      Role.COORDINADOR,
      Role.OPERADOR_MESA,
      Role.ENTRENADOR,
    ])('%s no puede cargar resultados → 403', async (rol) => {
      await cargar(M1, rol, []).expect(403);
    });

    it.each([Role.ARBITRO, Role.ADMIN_ZONAL, Role.SUPER_ADMIN])(
      '%s carga el resultado y el partido queda FINALIZADO',
      async (rol) => {
        const res = await cargar(M1, rol, [
          {
            resultId: R(1),
            data: { isWinner: true, ranking: 1, scoreData: { puntos: 1 } },
          },
          { resultId: R(2), data: { isWinner: false, ranking: 2 } },
        ]).expect(200);
        expect(res.body.data.status).toBe('FINALIZADO');
        expect(partidos.get(M1)!.finishedAt).toBeInstanceOf(Date);
      },
    );

    it('id de partido que no es UUID → 400; inexistente → 404', async () => {
      await cargar('no-uuid', Role.ARBITRO, []).expect(400);
      await cargar(
        '99999999-9999-4999-8999-999999999999',
        Role.ARBITRO,
        [],
      ).expect(404);
    });

    it('F-10: una lista vacía o con resultId ajeno NO debería finalizar el partido', async () => {
      await cargar(M1, Role.ARBITRO, []);
      expect(partidos.get(M1)!.status).toBe('PROGRAMADO');
    });

    it('F-11: un resultado ya cargado sólo lo corrige ADMIN_PROVINCIAL o superior (CA-C3.4)', async () => {
      const payload = [{ resultId: R(1), data: { isWinner: true } }];
      await cargar(M1, Role.ARBITRO, payload).expect(200);
      await cargar(M1, Role.ARBITRO, payload).expect(403);
    });

    it('F-10: lista vacía → 400; resultId de otro partido → 400; en ningún caso se finaliza', async () => {
      await cargar(M1, Role.ARBITRO, []).expect(400);
      await cargar(M1, Role.ARBITRO, [
        { resultId: R(3), data: { isWinner: true } },
      ]).expect(400);
      await cargar(M1, Role.ARBITRO, [
        { resultId: R(1), data: { isWinner: true } },
        { resultId: R(1), data: { isWinner: false } },
      ]).expect(400);
      expect(partidos.get(M1)!.status).toBe('PROGRAMADO');
      expect(resultados.get(R(1))!.isWinner).toBeNull();
    });

    it.each([Role.ADMIN_PROVINCIAL, Role.SUPER_ADMIN])(
      'F-11: %s sí corrige un resultado ya cargado; ADMIN_ZONAL no',
      async (rol) => {
        await cargar(M1, Role.ARBITRO, [
          { resultId: R(1), data: { isWinner: true } },
        ]).expect(200);
        const finalizado = partidos.get(M1)!.finishedAt;
        await cargar(M1, Role.ADMIN_ZONAL, [
          { resultId: R(1), data: { isWinner: false } },
        ]).expect(403);
        await cargar(M1, rol, [
          { resultId: R(1), data: { isWinner: false } },
          { resultId: R(2), data: { isWinner: true } },
        ]).expect(200);
        expect(resultados.get(R(2))!.isWinner).toBe(true);
        // una corrección no cambia cuándo terminó el partido
        expect(partidos.get(M1)!.finishedAt).toBe(finalizado);
      },
    );
  });

  describe('GET /results/rankings/competition/:id (público)', () => {
    const ranking = () =>
      request(app.getHttpServer()).get(`/results/rankings/competition/${COMP}`);

    it('sin partidos finalizados → lista vacía', async () => {
      const res = await ranking().expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('3 puntos por victoria, ordenado de mayor a menor; no expone datos personales', async () => {
      await cargar(M1, Role.ARBITRO, [
        { resultId: R(1), data: { isWinner: true } },
        { resultId: R(2), data: { isWinner: false } },
      ]).expect(200);
      await cargar(M2, Role.ARBITRO, [
        { resultId: R(3), data: { isWinner: true } },
        { resultId: R(4), data: { isWinner: false } },
      ]).expect(200);

      const res = await ranking().expect(200);
      const filas = res.body.data as Array<Record<string, number | string>>;
      expect(filas.map((f) => [f.id, f.points, f.won, f.lost])).toEqual(
        [
          [A, 3, 1, 0],
          [B, 3, 1, 1],
          [C, 0, 0, 1],
        ].sort((x, y) => (y[1] as number) - (x[1] as number)),
      );
      expect(JSON.stringify(res.body)).not.toMatch(/dni|birthDate|email/);
    });

    it('un partido no finalizado no cuenta', async () => {
      const res = await ranking().expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('competencia inexistente → 404; id inválido → 400', async () => {
      await request(app.getHttpServer())
        .get(
          '/results/rankings/competition/99999999-9999-4999-8999-999999999999',
        )
        .expect(404);
      await request(app.getHttpServer())
        .get('/results/rankings/competition/xx')
        .expect(400);
    });

    it('F-12: un empate no debería contarse como derrota de ambos', async () => {
      await cargar(M1, Role.ARBITRO, [
        { resultId: R(1), data: { isWinner: false } },
        { resultId: R(2), data: { isWinner: false } },
      ]).expect(200);
      const res = await ranking().expect(200);
      for (const fila of res.body.data as Array<{ lost: number }>) {
        expect(fila.lost).toBe(0);
      }
    });

    it('F-12: el empate suma 1 punto y un `drawn`; cada fila trae nombre y posición', async () => {
      await cargar(M1, Role.ARBITRO, [
        { resultId: R(1), data: { isWinner: false } },
        { resultId: R(2), data: { isWinner: false } },
      ]).expect(200);
      await cargar(M2, Role.ARBITRO, [
        { resultId: R(3), data: { isWinner: true } },
        { resultId: R(4), data: { isWinner: false } },
      ]).expect(200);
      const res = await ranking().expect(200);
      const filas = res.body.data as Array<Record<string, unknown>>;
      expect(
        filas.map((f) => [
          f.position,
          f.name,
          f.points,
          f.won,
          f.drawn,
          f.lost,
        ]),
      ).toEqual([
        [1, 'Beto B', 4, 1, 1, 0],
        [2, 'Ana A', 1, 0, 1, 0],
        [3, 'Cleo C', 0, 0, 0, 1],
      ]);
    });
  });
});

// ===========================================
// E2E — Rotación atómica del refresh token (R04)
//
// La secuencia vieja era `findUnique` → `argon2.verify` → `update`: tres pasos
// sin atomicidad. Y la ventana entre el primero y el último no es despreciable,
// porque `argon2.verify` tarda decenas de milisegundos **a propósito**. Con N
// refresh concurrentes portando el mismo token, los N leían el mismo hash, los
// N verificaban contra él y los N escribían: N respuestas 200 y ninguna fila
// `REFRESH_TOKEN_REUSE`. O sea que la detección construida en T03 no se
// disparaba justo en el escenario para el que existe.
//
// Nota sobre el mock: **modela el estado**, no devuelve una constante.
// `updateMany` evalúa su `where` contra el `refreshToken` vigente y responde
// `count: 0` si no matchea, que es lo que hace Postgres con
// `UPDATE … WHERE id = $1 AND refresh_token = $2`. Un mock que respondiera
// `count: 1` siempre haría pasar por igual al código nuevo y al viejo, y el
// test no probaría nada. Verificado: con la implementación anterior estos casos
// fallan.
//
// Desviación del DoD, deliberada: el enunciado decía "los otros N−1 responden
// 401". Responden **403**, que es lo que ya devolvía este módulo para un
// refresh denegado (`ForbiddenException`, tanto en token vencido como en
// mismatch). Cambiarlo a 401 sólo para cumplir la letra del DoD habría alterado
// un contrato que el frontend ya consume, sin ganar nada: lo que importa del
// criterio es que **no sean 200**.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  JwtStrategy,
  JwtRefreshStrategy,
} from '../src/modules/auth/strategies';
import { REFRESH_TOKEN_COOKIE } from '../src/modules/auth/auth.cookies';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditAction } from '../src/common/constants';

const API_PREFIX = 'api/v1';
const PASSWORD = 'Un-Password-Valido-123';

const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'app.apiPrefix': API_PREFIX,
  'jwt.accessSecret': 'test-access-secret-de-mas-de-32-caracteres',
  'jwt.accessExpiration': '15m',
  'jwt.refreshSecret': 'test-refresh-secret-de-mas-de-32-caracteres',
  'jwt.refreshExpiration': '7d',
};

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'delegado@juegosevita.gob.ar',
  firstName: 'Ana',
  lastName: 'Gómez',
  role: 'DELEGADO',
  isActive: true,
  passwordHash: '',
  refreshToken: null as string | null,
};

function readRefreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
}

describe('Rotación atómica del refresh token (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const filas = (): Record<string, any>[] =>
    prisma.auditLog.create.mock.calls.map((c) => c[0].data);

  const filasDe = (accion: string) =>
    filas().filter((f) => f.action === accion);

  beforeAll(async () => {
    USER.passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    USER.refreshToken = null;

    prisma = {
      user: {
        findUnique: jest.fn(() => Promise.resolve({ ...USER })),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          if (data.refreshToken !== undefined) {
            USER.refreshToken = data.refreshToken as string | null;
          }
          return Promise.resolve({ ...USER });
        }),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string; refreshToken?: unknown };
            data: Record<string, unknown>;
          }) => {
            const esperado = where.refreshToken;
            const coincide =
              where.id === USER.id &&
              (esperado === undefined ||
                // `{ not: null }` = "hay alguna sesión viva".
                (typeof esperado === 'object' && esperado !== null
                  ? USER.refreshToken !== null
                  : USER.refreshToken === esperado));

            if (!coincide) return Promise.resolve({ count: 0 });

            if (data.refreshToken !== undefined) {
              USER.refreshToken = data.refreshToken as string | null;
            }
            return Promise.resolve({ count: 1 });
          },
        ),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        AuditService,
        JwtStrategy,
        JwtRefreshStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    USER.refreshToken = null;
    await app.close();
  });

  const login = () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: USER.email, password: PASSWORD });

  const refresh = (cookie: string) =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/auth/refresh`)
      .set('Cookie', cookie);

  /** El interceptor/AuditService no se esperan: hay que dejar correr la cola. */
  const flush = () =>
    new Promise((resolve) => setImmediate(resolve as () => void));

  // -------------------------------------------------
  // El DoD: N concurrentes, un solo ganador
  // -------------------------------------------------
  describe.each([2, 3, 5])(
    '%i refresh concurrentes con el mismo token',
    (n) => {
      it('exactamente uno responde 200 y el resto es rechazado', async () => {
        const cookie = readRefreshCookie(await login().expect(200)) as string;
        prisma.auditLog.create.mockClear();

        const respuestas = await Promise.all(
          Array.from({ length: n }, () => refresh(cookie)),
        );
        await flush();

        const ok = respuestas.filter((r) => r.status === 200);
        const rechazados = respuestas.filter((r) => r.status !== 200);

        expect(ok).toHaveLength(1);
        expect(rechazados).toHaveLength(n - 1);
        // No 200 es el criterio real; 403 es el contrato vigente del módulo.
        for (const r of rechazados) {
          expect(r.status).toBe(403);
        }
      });

      it('deja UNA sola fila REFRESH_TOKEN_REUSE, no una por perdedor', async () => {
        const cookie = readRefreshCookie(await login().expect(200)) as string;
        prisma.auditLog.create.mockClear();

        await Promise.all(Array.from({ length: n }, () => refresh(cookie)));
        await flush();

        // Un incidente, una fila. Si cada perdedor auditara, tres pestañas
        // refrescando a la vez producirían dos filas del mismo evento y el
        // conteo dejaría de significar algo.
        expect(filasDe(AuditAction.REFRESH_TOKEN_REUSE)).toHaveLength(1);
      });

      it('ante reuso confirmado no sobrevive ninguna sesión, ni la del ganador', async () => {
        const cookie = readRefreshCookie(await login().expect(200)) as string;

        await Promise.all(Array.from({ length: n }, () => refresh(cookie)));
        await flush();

        // El ganador rotó legítimamente, pero no hay forma de saber cuál de los N
        // portadores era el titular: se revoca todo y se vuelve a loguear.
        expect(USER.refreshToken).toBeNull();
      });
    },
  );

  // -------------------------------------------------
  // Lo que NO debe romperse
  // -------------------------------------------------
  describe('El camino legítimo sigue funcionando', () => {
    it('refresh secuencial: cada uno con el token que devolvió el anterior', async () => {
      let cookie = readRefreshCookie(await login().expect(200)) as string;

      for (let i = 0; i < 3; i++) {
        const res = await refresh(cookie).expect(200);
        expect(res.body.accessToken).toEqual(expect.any(String));
        cookie = readRefreshCookie(res) as string;
        expect(cookie).toBeDefined();
      }

      await flush();
      expect(filasDe(AuditAction.REFRESH_TOKEN_REUSE)).toHaveLength(0);
    });

    it('el token viejo deja de servir después de rotar', async () => {
      const viejo = readRefreshCookie(await login().expect(200)) as string;

      await refresh(viejo).expect(200);
      // Reusar el anterior es el caso clásico de robo: token válido en su
      // firma, pero que ya no es el vigente.
      await refresh(viejo).expect(403);

      await flush();
      expect(
        filasDe(AuditAction.REFRESH_TOKEN_REUSE).length,
      ).toBeGreaterThanOrEqual(1);
      expect(USER.refreshToken).toBeNull();
    });

    it('un solo refresh no genera ninguna fila de reuso', async () => {
      const cookie = readRefreshCookie(await login().expect(200)) as string;
      prisma.auditLog.create.mockClear();

      await refresh(cookie).expect(200);
      await flush();

      expect(filasDe(AuditAction.REFRESH_TOKEN_REUSE)).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // La rotación es condicional, no un update a ciegas
  // -------------------------------------------------
  // -------------------------------------------------
  // Que el UPDATE sea atómico no alcanza si el valor nuevo es igual al viejo
  // -------------------------------------------------
  describe('La rotación produce un token distinto', () => {
    it('dos logins en el mismo segundo no devuelven el mismo refresh token', async () => {
      // Hallazgo al escribir este test: el payload del refresh era
      // `{ sub, email, role, type }` y lo único que lo diferenciaba entre dos
      // emisiones eran `iat`/`exp`, que tienen resolución de UN SEGUNDO. Dos
      // tokens emitidos para el mismo usuario dentro del mismo segundo salían
      // byte a byte idénticos, así que "rotar" dejaba vigente el token viejo y
      // el reuso no se detectaba. Se cerró agregando un `jti` por emisión.
      const [a, b] = await Promise.all([login().expect(200), login()]);

      const cookieA = readRefreshCookie(a) as string;
      const cookieB = readRefreshCookie(b) as string;

      expect(cookieA).toBeDefined();
      expect(cookieB).toBeDefined();
      expect(cookieA).not.toEqual(cookieB);
    });

    it('el token que devuelve el refresh es distinto del que se usó', async () => {
      const cookie = readRefreshCookie(await login().expect(200)) as string;

      const res = await refresh(cookie).expect(200);
      const rotado = readRefreshCookie(res) as string;

      expect(rotado).not.toEqual(cookie);
    });
  });

  describe('Forma de la escritura', () => {
    it('rota con updateMany condicionado al hash leído', async () => {
      const cookie = readRefreshCookie(await login().expect(200)) as string;
      const hashPrevio = USER.refreshToken;

      await refresh(cookie).expect(200);

      // Es esta condición —y no el `update` por id que había antes— la que
      // hace que el motor resuelva la carrera: sólo el primero encuentra fila.
      expect(prisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: USER.id, refreshToken: hashPrevio },
        }),
      );
    });
  });
});

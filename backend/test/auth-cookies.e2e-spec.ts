// ===========================================
// E2E — Contrato de la cookie httpOnly del refresh token
// Regresión C-03 / A-03 / F17: el refresh token no debe ser accesible por JS.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
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
// T25: AuthService ya no escribe en `auditLog` a mano — delega en AuditService.
import { AuditService } from '../src/modules/audit/audit.service';

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
  passwordHash: '', // se completa en beforeAll con un hash argon2 real
  refreshToken: null as string | null,
};

/** Emula el `select` de Prisma sobre una fila. */
function applySelect(
  row: Record<string, unknown>,
  select?: Record<string, boolean>,
): Record<string, unknown> {
  if (!select) return row;
  return Object.fromEntries(Object.entries(row).filter(([key]) => select[key]));
}

/** Devuelve el valor de la cookie de refresh a partir del header Set-Cookie. */
function readRefreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
}

describe('Auth — cookie httpOnly del refresh token (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeAll(async () => {
    USER.passwordHash = await argon2.hash(PASSWORD);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        // Devuelve el estado ACTUAL de USER (el login rota su refreshToken) y
        // respeta el `select`, igual que Prisma: así el test también verifica
        // que `getProfile` no pida columnas de más.
        findUnique: jest.fn(
          ({ select }: { select?: Record<string, boolean> }) =>
            Promise.resolve(applySelect({ ...USER }, select)),
        ),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          if (data.refreshToken !== undefined) {
            USER.refreshToken = data.refreshToken as string | null;
          }
          return Promise.resolve({ ...USER });
        }),
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
    jwtService = moduleFixture.get(JwtService);
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

  // -------------------------------------------------
  // C-03 — el refresh token sale sólo por cookie httpOnly
  // -------------------------------------------------
  describe('POST /auth/login', () => {
    it('no devuelve el refresh token en el body', async () => {
      const res = await login().expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(USER.email);
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    });

    it('setea la cookie con httpOnly, SameSite=Strict y path acotado', async () => {
      const res = await login().expect(200);
      const cookie = readRefreshCookie(res);

      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain(`Path=/${API_PREFIX}/auth`);
      expect(cookie).toContain('Max-Age=');
    });

    it('la cookie transporta un JWT de tipo refresh', async () => {
      const res = await login().expect(200);
      const cookie = readRefreshCookie(res) as string;
      const value = decodeURIComponent(
        cookie.split(';')[0].split('=').slice(1).join('='),
      );

      const payload = jwtService.verify(value, {
        secret: CONFIG['jwt.refreshSecret'] as string,
      });
      expect(payload.type).toBe('refresh');
      expect(payload.sub).toBe(USER.id);
    });

    it('no marca la cookie como Secure fuera de producción', async () => {
      const res = await login().expect(200);
      expect(readRefreshCookie(res)).not.toContain('Secure');
    });
  });

  // -------------------------------------------------
  // El refresh sale de la cookie, no del header
  // -------------------------------------------------
  describe('POST /auth/refresh', () => {
    it('renueva el access token leyendo la cookie', async () => {
      const loginRes = await login().expect(200);
      const cookie = readRefreshCookie(loginRes) as string;

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/refresh`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('refreshToken');
      // Rotación: la respuesta trae una cookie nueva.
      expect(readRefreshCookie(res)).toBeDefined();
    });

    it('rechaza el refresh token enviado por header Authorization', async () => {
      const loginRes = await login().expect(200);
      const cookie = readRefreshCookie(loginRes) as string;
      const token = decodeURIComponent(
        cookie.split(';')[0].split('=').slice(1).join('='),
      );

      // Vector viejo: el cliente guardaba el refresh token en localStorage y lo
      // mandaba como Bearer. Ahora no debe alcanzar para renovar la sesión.
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/refresh`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('rechaza el request sin cookie', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/refresh`)
        .expect(401);
    });
  });

  // -------------------------------------------------
  // Logout borra la cookie
  // -------------------------------------------------
  describe('POST /auth/logout', () => {
    it('limpia la cookie del navegador', async () => {
      const loginRes = await login().expect(200);
      const accessToken = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const cookie = readRefreshCookie(res) as string;
      expect(cookie).toBeDefined();
      // Expiración en el pasado = el navegador la borra.
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
      expect(cookie).toContain(`Path=/${API_PREFIX}/auth`);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { refreshToken: null } }),
      );
    });
  });

  // -------------------------------------------------
  // F17 — el perfil se rehidrata desde el servidor
  // -------------------------------------------------
  describe('GET /auth/me', () => {
    it('devuelve el perfil completo para rehidratar la sesión', async () => {
      const loginRes = await login().expect(200);

      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body).toEqual({
        id: USER.id,
        email: USER.email,
        firstName: USER.firstName,
        lastName: USER.lastName,
        role: USER.role,
      });
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('refreshToken');
    });

    it('rechaza el request sin access token', async () => {
      await request(app.getHttpServer())
        .get(`/${API_PREFIX}/auth/me`)
        .expect(401);
    });
  });
});

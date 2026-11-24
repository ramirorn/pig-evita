// ===========================================
// E2E — Sesión y autenticación (relevamiento OWASP 2025, unidad A)
//
// Cubre, por HTTP y contra un mock de Prisma que **modela el estado** (como
// `refresh-rotation.e2e-spec.ts`):
//
//   - VULN-05: cambiar contraseña, rol, alcance o estado revoca el refresh y
//     los access tokens ya emitidos; editar sólo el nombre no corta nada.
//   - VULN-22: bloqueo temporal por cuenta tras N fallos.
//   - VULN-23: política de contraseñas nuevas (no afecta a las existentes).
//   - VULN-25: el login y la gestión de usuarios no escriben emails en el log.
//   - VULN-37: login con mensaje y costo uniformes.
//   - VULN-38: `Secure` de la cookie no depende sólo de `NODE_ENV`.
//   - VULN-39: vida absoluta de la sesión en la rotación del refresh.
//   - VULN-45: las rutas de `/auth/*` siguen abiertas a todo rol autenticado.
//   - VULN-47: algoritmo fijo e `iss`/`aud` en los tokens.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthTokensService } from '../src/modules/auth/auth-tokens.service';
import {
  JwtStrategy,
  JwtRefreshStrategy,
} from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { REFRESH_TOKEN_COOKIE } from '../src/modules/auth/auth.cookies';
import { RevocacionSesionesService } from '../src/modules/auth/session-revocation.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { RolesGuard } from '../src/common/guards';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditAction, Role } from '../src/common/constants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const argon2Modulo = require('argon2') as typeof argon2;

const API = '/api/v1';
const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const REFRESH_SECRET = 'test-refresh-secret-de-mas-de-32-caracteres';

/** Contraseña de las cuentas sembradas: 8 caracteres, válida con la política vieja. */
const PW_VIEJA = 'Clave-01';
const PW_NUEVA = 'Otra-Clave-Robusta-2026';

const BASE_CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'app.apiPrefix': 'api/v1',
  'jwt.accessSecret': ACCESS_SECRET,
  'jwt.accessExpiration': '15m',
  'jwt.refreshSecret': REFRESH_SECRET,
  'jwt.refreshExpiration': '7d',
};

interface FilaUsuario {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  department: string | null;
  zone: string | null;
  passwordHash: string;
  refreshToken: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  delegado: '22222222-2222-4222-8222-222222222222',
  inactivo: '33333333-3333-4333-8333-333333333333',
  entrenador: '44444444-4444-4444-8444-444444444444',
};

const EMAILS = {
  admin: 'admin@juegosevita.gob.ar',
  delegado: 'delegado@juegosevita.gob.ar',
  inactivo: 'baja@juegosevita.gob.ar',
  entrenador: 'entrenador@juegosevita.gob.ar',
};

let hashVieja = '';

function sembrar(): Map<string, FilaUsuario> {
  const fila = (
    id: string,
    email: string,
    role: string,
    extra: Partial<FilaUsuario> = {},
  ): FilaUsuario => ({
    id,
    email,
    firstName: 'Nombre',
    lastName: 'Apellido',
    role,
    isActive: true,
    department: null,
    zone: null,
    passwordHash: hashVieja,
    refreshToken: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...extra,
  });
  return new Map(
    [
      fila(IDS.admin, EMAILS.admin, Role.SUPER_ADMIN),
      fila(IDS.delegado, EMAILS.delegado, Role.DELEGADO, {
        department: 'Formosa',
      }),
      fila(IDS.inactivo, EMAILS.inactivo, Role.DELEGADO, { isActive: false }),
      fila(IDS.entrenador, EMAILS.entrenador, Role.ENTRENADOR),
    ].map((u) => [u.id, u]),
  );
}

/** Proyección mínima de `select` de Prisma: sólo las claves pedidas. */
function proyectar(fila: FilaUsuario, select?: Record<string, boolean>) {
  if (!select) return { ...fila };
  return Object.fromEntries(
    Object.keys(select)
      .filter((k) => select[k])
      .map((k) => [k, fila[k as keyof FilaUsuario]]),
  );
}

function crearPrismaMock(usuarios: Map<string, FilaUsuario>) {
  const buscar = (where: { id?: string; email?: string }) =>
    where.id !== undefined
      ? usuarios.get(where.id)
      : [...usuarios.values()].find((u) => u.email === where.email);

  const aplicar = (fila: FilaUsuario, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) (fila as unknown as Record<string, unknown>)[k] = v;
    }
  };

  return {
    user: {
      findUnique: jest.fn(
        ({
          where,
          select,
        }: {
          where: { id?: string; email?: string };
          select?: Record<string, boolean>;
        }) => {
          const fila = buscar(where);
          return Promise.resolve(fila ? proyectar(fila, select) : null);
        },
      ),
      findFirst: jest.fn(
        ({ where }: { where: { email: string; NOT: { id: string } } }) =>
          Promise.resolve(
            [...usuarios.values()].find(
              (u) => u.email === where.email && u.id !== where.NOT.id,
            ) ?? null,
          ),
      ),
      count: jest.fn(
        ({
          where,
        }: {
          where: { role: string; isActive: boolean; NOT: { id: string } };
        }) =>
          Promise.resolve(
            [...usuarios.values()].filter(
              (u) =>
                u.role === where.role &&
                u.isActive === where.isActive &&
                u.id !== where.NOT.id,
            ).length,
          ),
      ),
      create: jest.fn(
        ({
          data,
          select,
        }: {
          data: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const fila = {
            ...sembrar().get(IDS.delegado)!,
            id: randomUUID(),
            department: null,
            refreshToken: null,
          } as FilaUsuario;
          aplicar(fila, data);
          usuarios.set(fila.id, fila);
          return Promise.resolve(proyectar(fila, select));
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
          select,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
          select?: Record<string, boolean>;
        }) => {
          const fila = usuarios.get(where.id)!;
          aplicar(fila, data);
          return Promise.resolve(proyectar(fila, select));
        },
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; refreshToken?: unknown };
          data: Record<string, unknown>;
        }) => {
          const fila = usuarios.get(where.id);
          const esperado = where.refreshToken;
          const coincide =
            !!fila &&
            (esperado === undefined ||
              (typeof esperado === 'object' && esperado !== null
                ? fila.refreshToken !== null
                : fila.refreshToken === esperado));
          if (!coincide) return Promise.resolve({ count: 0 });
          aplicar(fila, data);
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function cookieDeRefresh(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
}

function valorDeCookie(cookie: string): string {
  return cookie.split(';')[0].slice(REFRESH_TOKEN_COOKIE.length + 1);
}

/** Decodifica un JWT sin verificarlo (cabecera y payload). */
function decodificar(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const [h, p] = token.split('.');
  const json = (s: string) =>
    JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  return { header: json(h), payload: json(p) };
}

/**
 * Espera a que cambie el segundo del reloj. Los `iat` de JWT tienen resolución
 * de un segundo; la revocación corta todo lo emitido hasta el segundo en que
 * ocurrió, así que un login "posterior" tiene que caer en el segundo siguiente.
 */
async function esperarSiguienteSegundo(): Promise<void> {
  const ahora = Date.now();
  await new Promise((r) => setTimeout(r, 1000 - (ahora % 1000) + 20));
}

describe('Sesión y autenticación — unidad A del relevamiento OWASP 2025 (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let usuarios: Map<string, FilaUsuario>;
  let prisma: ReturnType<typeof crearPrismaMock>;
  let config: Record<string, unknown>;

  beforeAll(async () => {
    hashVieja = await argon2.hash(PW_VIEJA);
  });

  const levantar = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AuthController, UsersController],
      providers: [
        AuthService,
        AuthTokensService,
        UsersService,
        AuditService,
        JwtStrategy,
        JwtRefreshStrategy,
        RevocacionSesionesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, def?: unknown) => config[k] ?? def),
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
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
  };

  beforeEach(async () => {
    config = { ...BASE_CONFIG };
    usuarios = sembrar();
    prisma = crearPrismaMock(usuarios);
    await levantar();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  const login = (email: string, password: string) =>
    request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password });

  const sesion = async (email: string, password = PW_VIEJA) => {
    const res = await login(email, password).expect(200);
    const body = res.body as { accessToken: string };
    return {
      access: body.accessToken,
      cookie: valorDeCookie(cookieDeRefresh(res)!),
    };
  };

  const refrescar = (cookie: string) =>
    request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${cookie}`);

  const me = (access: string) =>
    request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${access}`);

  /**
   * `/auth/permissions` no consulta la base: responde sólo con lo que dice el
   * token. Es la sonda justa para probar que un access token revocado deja de
   * valer (`/auth/me` relee `isActive` y lo taparía en el caso de la baja).
   */
  const permisos = (access: string) =>
    request(app.getHttpServer())
      .get(`${API}/auth/permissions`)
      .set('Authorization', `Bearer ${access}`);

  const patchUsuario = (access: string, id: string, body: object) =>
    request(app.getHttpServer())
      .patch(`${API}/users/${id}`)
      .set('Authorization', `Bearer ${access}`)
      .send(body);

  // -------------------------------------------------
  // VULN-05
  // -------------------------------------------------
  describe('VULN-05 — los cambios sensibles revocan las sesiones', () => {
    it('PATCH con contraseña nueva ⇒ el refresh del usuario editado responde 403', async () => {
      const admin = await sesion(EMAILS.admin);
      const delegado = await sesion(EMAILS.delegado);

      await patchUsuario(admin.access, IDS.delegado, {
        password: PW_NUEVA,
      }).expect(200);

      expect(usuarios.get(IDS.delegado)!.refreshToken).toBeNull();
      await refrescar(delegado.cookie).expect(403);
    });

    it('PATCH de rol ⇒ el access token ya emitido deja de valer (401)', async () => {
      const admin = await sesion(EMAILS.admin);
      const delegado = await sesion(EMAILS.delegado);
      await permisos(delegado.access).expect(200);

      await patchUsuario(admin.access, IDS.delegado, {
        role: Role.COORDINADOR,
      }).expect(200);

      await permisos(delegado.access).expect(401);
      await refrescar(delegado.cookie).expect(403);
    });

    it('PATCH de departamento o de estado también revoca', async () => {
      const admin = await sesion(EMAILS.admin);
      const delegado = await sesion(EMAILS.delegado);

      await patchUsuario(admin.access, IDS.delegado, {
        department: 'Pilcomayo',
      }).expect(200);
      await permisos(delegado.access).expect(401);

      await esperarSiguienteSegundo();
      const otra = await sesion(EMAILS.delegado);
      await patchUsuario(admin.access, IDS.delegado, {
        isActive: false,
      }).expect(200);
      await permisos(otra.access).expect(401);
      await refrescar(otra.cookie).expect(403);
    });

    it('DELETE ⇒ el access token ya emitido deja de valer (401)', async () => {
      const admin = await sesion(EMAILS.admin);
      const delegado = await sesion(EMAILS.delegado);

      await request(app.getHttpServer())
        .delete(`${API}/users/${IDS.delegado}`)
        .set('Authorization', `Bearer ${admin.access}`)
        .expect(200);

      await permisos(delegado.access).expect(401);
    });

    it('comportamiento previo: editar sólo el nombre (con rol y estado sin cambios) conserva la sesión', async () => {
      const admin = await sesion(EMAILS.admin);
      const delegado = await sesion(EMAILS.delegado);

      // El formulario del frontend manda rol, departamento y estado siempre,
      // aunque no cambien: eso no puede cerrar la sesión de nadie.
      await patchUsuario(admin.access, IDS.delegado, {
        firstName: 'Otro',
        role: Role.DELEGADO,
        department: 'Formosa',
        isActive: true,
      }).expect(200);

      await permisos(delegado.access).expect(200);
      await refrescar(delegado.cookie).expect(200);
    });

    it('un login posterior al cambio emite tokens que sí valen', async () => {
      const admin = await sesion(EMAILS.admin);
      await patchUsuario(admin.access, IDS.delegado, {
        password: PW_NUEVA,
      }).expect(200);

      await esperarSiguienteSegundo();
      const nueva = await sesion(EMAILS.delegado, PW_NUEVA);
      await permisos(nueva.access).expect(200);
      await refrescar(nueva.cookie).expect(200);
    });
  });

  // -------------------------------------------------
  // VULN-37
  // -------------------------------------------------
  describe('VULN-37 — login uniforme', () => {
    it('email inexistente, cuenta inactiva y contraseña incorrecta responden el mismo 401', async () => {
      const inexistente = await login('nadie@juegosevita.gob.ar', PW_VIEJA);
      const inactiva = await login(EMAILS.inactivo, PW_VIEJA);
      const incorrecta = await login(EMAILS.delegado, 'incorrecta-123');

      for (const r of [inexistente, inactiva, incorrecta]) {
        expect(r.status).toBe(401);
        expect((r.body as { message: string }).message).toBe(
          'Credenciales inválidas',
        );
      }
    });

    it('con un email inexistente igual se ejecuta argon2.verify (mismo costo)', async () => {
      const verify = jest.spyOn(argon2Modulo, 'verify');
      await login('nadie@juegosevita.gob.ar', PW_VIEJA).expect(401);
      expect(verify).toHaveBeenCalledTimes(1);
    });

    it('la cuenta inactiva queda auditada con su motivo', async () => {
      await login(EMAILS.inactivo, PW_VIEJA).expect(401);
      const filas = prisma.auditLog.create.mock.calls.map(
        (c: [{ data: Record<string, unknown> }]) => c[0].data,
      );
      expect(
        filas.some(
          (f) =>
            f.action === AuditAction.LOGIN_FAILED &&
            f.userId === IDS.inactivo &&
            JSON.stringify(f.changes).includes('inactive'),
        ),
      ).toBe(true);
    });
  });

  // -------------------------------------------------
  // VULN-22
  // -------------------------------------------------
  describe('VULN-22 — bloqueo temporal por cuenta', () => {
    it('tras 10 fallos la cuenta responde 429 aun con la contraseña correcta; otra cuenta no se ve afectada', async () => {
      for (let i = 0; i < 10; i++) {
        await login(EMAILS.delegado, `incorrecta-${i}-x`).expect(401);
      }
      const r = await login(EMAILS.delegado, PW_VIEJA);
      expect(r.status).toBe(429);

      await login(EMAILS.admin, PW_VIEJA).expect(200);
    });

    it('un email inexistente se bloquea igual (el bloqueo no revela qué cuentas existen)', async () => {
      for (let i = 0; i < 10; i++) {
        await login('nadie@juegosevita.gob.ar', `incorrecta-${i}-x`).expect(
          401,
        );
      }
      await login('nadie@juegosevita.gob.ar', PW_VIEJA).expect(429);
    });

    it('comportamiento previo: con menos fallos que el umbral el login correcto entra y reinicia el contador', async () => {
      for (let i = 0; i < 9; i++) {
        await login(EMAILS.delegado, `incorrecta-${i}-x`).expect(401);
      }
      await login(EMAILS.delegado, PW_VIEJA).expect(200);
      for (let i = 0; i < 9; i++) {
        await login(EMAILS.delegado, `incorrecta-${i}-y`).expect(401);
      }
      await login(EMAILS.delegado, PW_VIEJA).expect(200);
    });
  });

  // -------------------------------------------------
  // VULN-38
  // -------------------------------------------------
  describe('VULN-38 — flag Secure de la cookie de refresh', () => {
    const esSecure = async () => {
      const res = await login(EMAILS.delegado, PW_VIEJA).expect(200);
      return /;\s*Secure/i.test(cookieDeRefresh(res)!);
    };

    it('comportamiento previo: en desarrollo por HTTP plano no lleva Secure', async () => {
      expect(await esSecure()).toBe(false);
    });

    it('comportamiento previo: en producción siempre lleva Secure', async () => {
      config['app.nodeEnv'] = 'production';
      expect(await esSecure()).toBe(true);
    });

    it('con COOKIE_SECURE=true lleva Secure aunque NODE_ENV no sea production', async () => {
      config.COOKIE_SECURE = 'true';
      expect(await esSecure()).toBe(true);
    });

    it('si el request llegó por HTTPS (proxy de confianza) lleva Secure aunque NODE_ENV=development', async () => {
      config['app.nodeEnv'] = 'development';
      const res = await login(EMAILS.delegado, PW_VIEJA)
        .set('X-Forwarded-Proto', 'https')
        .expect(200);
      expect(cookieDeRefresh(res)).toMatch(/;\s*Secure/i);
    });

    it('COOKIE_SECURE=false no le quita Secure a producción', async () => {
      config['app.nodeEnv'] = 'production';
      config.COOKIE_SECURE = 'false';
      expect(await esSecure()).toBe(true);
    });
  });

  // -------------------------------------------------
  // VULN-39
  // -------------------------------------------------
  describe('VULN-39 — vida absoluta de la sesión', () => {
    it('pasada la vida máxima, el refresh responde 403 y la sesión queda cerrada', async () => {
      config.JWT_SESSION_MAX_AGE = '1s';
      const delegado = await sesion(EMAILS.delegado);
      await new Promise((r) => setTimeout(r, 2100));

      const r = await refrescar(delegado.cookie);
      expect(r.status).toBe(403);
      expect(usuarios.get(IDS.delegado)!.refreshToken).toBeNull();
    }, 15000);

    it('comportamiento previo: dentro de la vida máxima rota y conserva el inicio de la sesión', async () => {
      const delegado = await sesion(EMAILS.delegado);
      const original = decodificar(delegado.cookie).payload;
      expect(typeof original.auth_time).toBe('number');

      const r = await refrescar(delegado.cookie).expect(200);
      const nuevo = decodificar(valorDeCookie(cookieDeRefresh(r)!)).payload;
      expect(nuevo.auth_time).toBe(original.auth_time);
    });
  });

  // -------------------------------------------------
  // VULN-47
  // -------------------------------------------------
  describe('VULN-47 — algoritmo fijo e iss/aud', () => {
    it('los tokens emitidos llevan HS256, iss y aud propios', async () => {
      const s = await sesion(EMAILS.delegado);
      const access = decodificar(s.access);
      const refresh = decodificar(s.cookie);
      expect(access.header.alg).toBe('HS256');
      expect(access.payload).toMatchObject({
        iss: 'evita-api',
        aud: 'evita-web',
      });
      expect(refresh.header.alg).toBe('HS256');
      expect(refresh.payload).toMatchObject({
        iss: 'evita-api',
        aud: 'evita-refresh',
      });
    });

    it('un access token firmado con otro algoritmo (HS512, mismo secreto) se rechaza', async () => {
      const token = jwt.sign(
        { sub: IDS.delegado, email: 'x', role: Role.DELEGADO, type: 'access' },
        {
          secret: ACCESS_SECRET,
          algorithm: 'HS512',
          issuer: 'evita-api',
          audience: 'evita-web',
        },
      );
      await me(token).expect(401);
    });

    it('un access token de otro emisor o audiencia se rechaza', async () => {
      const deOtro = jwt.sign(
        { sub: IDS.delegado, email: 'x', role: Role.DELEGADO, type: 'access' },
        { secret: ACCESS_SECRET, issuer: 'otro-servicio' },
      );
      const otraAudiencia = jwt.sign(
        { sub: IDS.delegado, email: 'x', role: Role.DELEGADO, type: 'access' },
        { secret: ACCESS_SECRET, issuer: 'evita-api', audience: 'otra-app' },
      );
      await me(deOtro).expect(401);
      await me(otraAudiencia).expect(401);
    });

    it('un refresh token sin iss/aud (emitido antes del despliegue) se rechaza con 401', async () => {
      const legado = jwt.sign(
        {
          sub: IDS.delegado,
          email: 'x',
          role: Role.DELEGADO,
          type: 'refresh',
          jti: randomUUID(),
        },
        { secret: REFRESH_SECRET },
      );
      await refrescar(legado).expect(401);
    });

    it('un access token sin iss/aud (legado) se rechaza con 401', async () => {
      // Cierre de VULN-47: la transición que los aceptaba terminó.
      const legado = jwt.sign(
        { sub: IDS.delegado, email: 'x', role: Role.DELEGADO, type: 'access' },
        { secret: ACCESS_SECRET },
      );
      await me(legado).expect(401);
    });
  });

  // -------------------------------------------------
  // VULN-45 (parte de auth)
  // -------------------------------------------------
  describe('VULN-45 — /auth/* sigue abierto a todo rol autenticado', () => {
    it('un ENTRENADOR (sin acciones asignadas) llega a me, permissions y logout', async () => {
      const s = await sesion(EMAILS.entrenador);
      const auth = { Authorization: `Bearer ${s.access}` };
      await request(app.getHttpServer())
        .get(`${API}/auth/me`)
        .set(auth)
        .expect(200);
      await request(app.getHttpServer())
        .get(`${API}/auth/permissions`)
        .set(auth)
        .expect(200);
      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .set(auth)
        .expect(200);
    });

    it('pero no llega a una ruta con @Roles (403)', async () => {
      const s = await sesion(EMAILS.entrenador);
      await request(app.getHttpServer())
        .get(`${API}/users`)
        .set('Authorization', `Bearer ${s.access}`)
        .expect(403);
    });
  });

  // -------------------------------------------------
  // VULN-23
  // -------------------------------------------------
  describe('VULN-23 — política de contraseñas nuevas', () => {
    const crear = (access: string, password: string) =>
      request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${access}`)
        .send({
          email: `nuevo.${randomUUID().slice(0, 8)}@juegosevita.gob.ar`,
          password,
          firstName: 'Nuevo',
          lastName: 'Usuario',
          role: Role.ARBITRO,
        });

    it('rechaza contraseñas nuevas de menos de 12 caracteres (alta y edición)', async () => {
      const admin = await sesion(EMAILS.admin);
      const r = await crear(admin.access, 'Corta-12345');
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain('12 caracteres');

      await patchUsuario(admin.access, IDS.delegado, {
        password: 'Corta-12345',
      }).expect(400);
    });

    it('rechaza contraseñas comunes aunque sean largas', async () => {
      const admin = await sesion(EMAILS.admin);
      for (const comun of [
        'Password2026!',
        'contraseña12345',
        'JuegosEvita2026',
        '123456789012',
        'qwertyuiop123',
        'aaaaaaaaaaaaaa',
      ]) {
        const r = await crear(admin.access, comun);
        expect({ comun, status: r.status }).toEqual({ comun, status: 400 });
      }
    });

    it('acepta una contraseña robusta', async () => {
      const admin = await sesion(EMAILS.admin);
      await crear(admin.access, PW_NUEVA).expect(201);
    });

    it('comportamiento previo: una cuenta existente con contraseña de 8 caracteres sigue entrando', async () => {
      await login(EMAILS.delegado, PW_VIEJA).expect(200);
    });
  });

  // -------------------------------------------------
  // VULN-25 (parte de auth y users)
  // -------------------------------------------------
  describe('VULN-25 — sin emails en el log de aplicación', () => {
    it('login, alta y edición de usuarios no escriben el email en el log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log');
      const admin = await sesion(EMAILS.admin);
      const email = 'persona.real@juegosevita.gob.ar';
      await request(app.getHttpServer())
        .post(`${API}/users`)
        .set('Authorization', `Bearer ${admin.access}`)
        .send({
          email,
          password: PW_NUEVA,
          firstName: 'Persona',
          lastName: 'Real',
          role: Role.ARBITRO,
        })
        .expect(201);
      await patchUsuario(admin.access, IDS.delegado, {
        firstName: 'Otro',
      }).expect(200);

      const escrito = JSON.stringify(log.mock.calls);
      expect(escrito).not.toContain(EMAILS.admin);
      expect(escrito).not.toContain(email);
      expect(escrito).not.toContain(EMAILS.delegado);
    });
  });
});

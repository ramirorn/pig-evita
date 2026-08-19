// ===========================================
// E2E — IP y User-Agent en la auditoría (T07 / A-06)
//
// El DoD original pide "mirar un registro de AuditLog con ambos campos
// poblados", pero acá no hay base de datos. La evidencia equivalente y
// ejecutable es disparar la operación real por HTTP y comprobar qué `data`
// recibió `prisma.auditLog.create`: es exactamente la fila que se habría
// insertado. Además se verifica que `trust proxy` haga que la IP registrada
// sea la del cliente y no la del reverse proxy (nginx).
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  JwtStrategy,
  JwtRefreshStrategy,
} from '../src/modules/auth/strategies';
import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { PrismaService } from '../src/database/prisma.service';

const API_PREFIX = 'api/v1';
const PASSWORD = 'Un-Password-Valido-123';

// UA reconocible: si aparece en la fila, viajó de punta a punta.
const USER_AGENT = 'EvitaTest/1.0 (e2e; auditoria)';
// IP del cliente real, la que nginx pondría en X-Forwarded-For.
const IP_CLIENTE = '203.0.113.77';
// IP falsa que un cliente malicioso podría inyectar en su propio
// X-Forwarded-For antes de que nginx le anexe la IP real.
const IP_FALSIFICADA = '198.51.100.13';
// Lo que ve Express en producción: lo que mandó el cliente y, anexada por
// nginx, la IP real desde la que se conectó.
const XFF_CON_SPOOF = `${IP_FALSIFICADA}, ${IP_CLIENTE}`;

const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'app.apiPrefix': API_PREFIX,
  'jwt.accessSecret': 'test-access-secret-de-mas-de-32-caracteres',
  'jwt.accessExpiration': '15m',
  'jwt.refreshSecret': 'test-refresh-secret-de-mas-de-32-caracteres',
  'jwt.refreshExpiration': '7d',
};

const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'delegado@juegosevita.gob.ar',
  firstName: 'Ana',
  lastName: 'Gómez',
  role: 'DELEGADO',
  isActive: true,
  passwordHash: '',
  refreshToken: null as string | null,
};

/**
 * El interceptor llama a `auditService.log()` sin await (no debe demorar la
 * respuesta), así que después del request hay que dejar correr la microtask
 * pendiente antes de mirar el mock.
 */
const flushAuditoria = () =>
  new Promise((resolve) => setImmediate(resolve as () => void));

describe('Auditoría — IP y User-Agent (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  /** Devuelve el `data` de la última fila que se hubiera insertado. */
  const ultimaFila = (): Record<string, unknown> => {
    const llamadas = prisma.auditLog.create.mock.calls;
    expect(llamadas.length).toBeGreaterThan(0);
    return llamadas[llamadas.length - 1][0].data as Record<string, unknown>;
  };

  beforeAll(async () => {
    USER.passwordHash = await argon2.hash(PASSWORD);
  });

  /**
   * Levanta la app. `trustProxy` replica lo que hace main.ts, para poder
   * contrastar el comportamiento con y sin la configuración.
   */
  async function crearApp(trustProxy: boolean): Promise<void> {
    prisma = {
      user: {
        findUnique: jest.fn(() => Promise.resolve({ ...USER })),
        update: jest.fn(() => Promise.resolve({ ...USER })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AuthController, DisciplinesController],
      providers: [
        AuthService,
        AuditService,
        JwtStrategy,
        JwtRefreshStrategy,
        {
          provide: DisciplinesService,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'd1' }) },
        },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    if (trustProxy) {
      app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }
    await app.init();
  }

  afterEach(async () => {
    USER.refreshToken = null;
    await app.close();
  });

  // -------------------------------------------------
  // Interceptor: operaciones de escritura comunes
  // -------------------------------------------------
  describe('AuditInterceptor sobre una escritura', () => {
    beforeEach(() => crearApp(true));

    it('persiste ipAddress y userAgent poblados', async () => {
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/disciplines`)
        .set('User-Agent', USER_AGENT)
        .set('X-Forwarded-For', IP_CLIENTE)
        .send({ name: 'Fútbol 11', type: 'EQUIPO', resultType: 'PUNTAJE' })
        .expect(201);

      await flushAuditoria();

      const fila = ultimaFila();
      expect(fila.action).toBe('CREATE');
      expect(fila.entity).toBe('disciplines');
      // El corazón del DoD: ambos campos con contenido, no null ni undefined.
      expect(fila.ipAddress).toBe(IP_CLIENTE);
      expect(fila.userAgent).toBe(USER_AGENT);
    });
  });

  // -------------------------------------------------
  // Eventos de autenticación (parte b de T07)
  // -------------------------------------------------
  describe('Eventos de auth', () => {
    beforeEach(() => crearApp(true));

    const login = (password: string) =>
      request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/login`)
        .set('User-Agent', USER_AGENT)
        .set('X-Forwarded-For', IP_CLIENTE)
        .send({ email: USER.email, password });

    it('LOGIN registra el origen del request', async () => {
      await login(PASSWORD).expect(200);

      const fila = ultimaFila();
      expect(fila.action).toBe('LOGIN');
      expect(fila.ipAddress).toBe(IP_CLIENTE);
      expect(fila.userAgent).toBe(USER_AGENT);
    });

    it('LOGIN_FAILED registra el origen (sirve para detectar credential stuffing)', async () => {
      await login('password-incorrecto').expect(401);

      const fila = ultimaFila();
      expect(fila.action).toBe('LOGIN_FAILED');
      expect(fila.ipAddress).toBe(IP_CLIENTE);
      expect(fila.userAgent).toBe(USER_AGENT);
    });

    it('LOGOUT registra el origen', async () => {
      const res = await login(PASSWORD).expect(200);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .set('User-Agent', USER_AGENT)
        .set('X-Forwarded-For', IP_CLIENTE)
        .expect(200);

      const fila = ultimaFila();
      expect(fila.action).toBe('LOGOUT');
      expect(fila.ipAddress).toBe(IP_CLIENTE);
      expect(fila.userAgent).toBe(USER_AGENT);
    });
  });

  // -------------------------------------------------
  // trust proxy — el motivo por el que T07 destraba T05
  // -------------------------------------------------
  describe('trust proxy', () => {
    it('con trust proxy se guarda la IP del cliente y no se cree el header falsificado', async () => {
      await crearApp(true);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/login`)
        .set('User-Agent', USER_AGENT)
        // Con un único salto de confianza, Express toma la última entrada —la
        // que anexa nginx, imposible de falsificar— e ignora lo que el cliente
        // haya escrito a la izquierda. Por eso el valor es 1 y no `true`.
        .set('X-Forwarded-For', XFF_CON_SPOOF)
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);

      expect(ultimaFila().ipAddress).toBe(IP_CLIENTE);
    });

    it('sin trust proxy se pierde la IP del cliente (regresión de A-06)', async () => {
      await crearApp(false);

      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/auth/login`)
        .set('User-Agent', USER_AGENT)
        .set('X-Forwarded-For', XFF_CON_SPOOF)
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);

      // Express ignora X-Forwarded-For y registra el socket remoto: en
      // producción, siempre la misma IP de nginx para todos los usuarios.
      const ip = ultimaFila().ipAddress as string;
      expect(ip).not.toBe(IP_CLIENTE);
      expect(ip).toMatch(/127\.0\.0\.1|::1|::ffff:127\.0\.0\.1/);
    });
  });
});

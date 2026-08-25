// ===========================================
// E2E — Contrato de auditoría (T25 / hallazgo Q10)
//
// Sin base de datos: la evidencia equivalente y ejecutable es contar y mirar
// las llamadas a `prisma.auditLog.create`, que son exactamente las filas que
// se habrían insertado.
//
// Cubre las cuatro promesas del contrato documentado en
// `src/common/decorators/audit.decorator.ts`:
//   1. una operación produce UNA fila (el DoD literal de T25);
//   2. lo que no está decorado se audita igual (fail-safe del opt-out);
//   3. `changes` no puede llevar secretos ni PII, a ninguna profundidad;
//   4. el reuso de refresh token deja rastro.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  Body,
  Controller,
  INestApplication,
  Patch,
  Post,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import * as argon2 from 'argon2';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  JwtStrategy,
  JwtRefreshStrategy,
} from '../src/modules/auth/strategies';
import { REFRESH_TOKEN_COOKIE } from '../src/modules/auth/auth.cookies';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/database/prisma.service';
import { Audit, NoAudit, AUDIT_KEY } from '../src/common/decorators';
import { AuditAction } from '../src/common/constants';
import { REDACTED } from '../src/modules/audit/audit-sanitizer';

const API_PREFIX = 'api/v1';
const PASSWORD = 'Un-Password-Valido-123';
const USER_AGENT = 'EvitaTest/1.0 (e2e; contrato-auditoria)';
const IP_CLIENTE = '203.0.113.99';

const INSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'app.apiPrefix': API_PREFIX,
  'jwt.accessSecret': 'test-access-secret-de-mas-de-32-caracteres',
  'jwt.accessExpiration': '15m',
  'jwt.refreshSecret': 'test-refresh-secret-de-mas-de-32-caracteres',
  'jwt.refreshExpiration': '7d',
};

const USER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'delegado@juegosevita.gob.ar',
  firstName: 'Ana',
  lastName: 'Gómez',
  role: 'DELEGADO',
  isActive: true,
  passwordHash: '',
  refreshToken: null as string | null,
};

/**
 * Controller de mentira para probar las dos puntas del contrato que ningún
 * controller real ejercita todavía: el default (sin decorador se audita igual)
 * y la exclusión explícita con `@NoAudit()`.
 */
@Controller('sondas')
class SondaController {
  @Post('sin-decorador')
  sinDecorador(@Body() body: unknown) {
    return { recibido: body };
  }

  @Post('excluido')
  @NoAudit() // motivo: endpoint de prueba sin valor forense
  excluido() {
    return { ok: true };
  }

  @Patch('accion-de-negocio')
  @Audit({ entity: 'otra_entidad', action: 'ACCION_DE_NEGOCIO' })
  accionDeNegocio() {
    return { ok: true };
  }

  /** Escritura sobre un recurso con id, para ejercitar el bypass de R02. */
  @Patch(':id')
  actualizar() {
    return { ok: true };
  }
}

/**
 * Controller cuyo prefijo *empieza* con "auth" sin serlo.
 *
 * La exclusión vieja usaba `includes('/auth/')`; la nueva compara el primer
 * segmento por igualdad. Sin este controller no habría forma de probar que el
 * arreglo no se pasó de largo y ahora excluye de más.
 */
@Controller('authors')
class AuthorsController {
  @Post()
  crear() {
    return { ok: true };
  }
}

/** El interceptor no espera a `log()`: hay que dejar correr la microtask. */
const flush = () =>
  new Promise((resolve) => setImmediate(resolve as () => void));

describe('Contrato de auditoría (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  /** Todas las filas que se habrían insertado, en orden. */
  const filas = (): Record<string, any>[] =>
    prisma.auditLog.create.mock.calls.map((c) => c[0].data);

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
        // Rotación condicional de R04. El `where` se evalúa de verdad contra el
        // estado actual: un mock que devolviera `count: 1` siempre haría pasar
        // por igual al código nuevo y al viejo.
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
      controllers: [
        AuthController,
        InscriptionsController,
        UsersController,
        SondaController,
        AuthorsController,
      ],
      providers: [
        AuthService,
        AuditService,
        JwtStrategy,
        JwtRefreshStrategy,
        {
          provide: InscriptionsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: INSCRIPTION_ID }),
            approve: jest.fn().mockResolvedValue({ id: INSCRIPTION_ID }),
            reject: jest.fn().mockResolvedValue({ id: INSCRIPTION_ID }),
          },
        },
        {
          provide: UsersService,
          useValue: { create: jest.fn().mockResolvedValue({ id: USER.id }) },
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
    app.use(cookieParser());
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (path: string) =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}${path}`)
      .set('User-Agent', USER_AGENT)
      .set('X-Forwarded-For', IP_CLIENTE);

  const patch = (path: string) =>
    request(app.getHttpServer())
      .patch(`/${API_PREFIX}${path}`)
      .set('User-Agent', USER_AGENT)
      .set('X-Forwarded-For', IP_CLIENTE);

  // -------------------------------------------------
  // 1. El DoD literal de T25: una operación, una fila
  // -------------------------------------------------
  describe('Sin doble registro', () => {
    it('crear una inscripción produce exactamente UNA fila para esa entidad', async () => {
      await post('/inscriptions')
        .send({ participantId: 'p1', categoryId: 'c1', dni: '40123456' })
        .expect(201);

      await flush();

      // Equivalente ejecutable de
      // SELECT COUNT(*) FROM AuditLog WHERE entityId = INSCRIPTION_ID → 1
      const delaInscripcion = filas().filter(
        (f) => f.entityId === INSCRIPTION_ID,
      );
      expect(delaInscripcion).toHaveLength(1);
      expect(delaInscripcion[0].action).toBe('CREATE');
      expect(delaInscripcion[0].entity).toBe('inscriptions');
    });

    it('la creación registra el id del recurso recién creado', async () => {
      await post('/inscriptions').send({ participantId: 'p1' }).expect(201);
      await flush();

      // Antes de T25 el entityId de todo CREATE era null (la URL de un POST
      // todavía no tiene id), y la consulta del DoD no podía dar 1 ni queriendo.
      expect(filas()[0].entityId).toBe(INSCRIPTION_ID);
    });

    it('un login produce UNA fila, no una del interceptor y otra del service', async () => {
      await post('/auth/login')
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);

      await flush();

      expect(filas()).toHaveLength(1);
      expect(filas()[0].action).toBe(AuditAction.LOGIN);
    });

    it('aprobar una inscripción produce UNA fila, con la acción de negocio', async () => {
      await patch(`/inscriptions/${INSCRIPTION_ID}/approve`).expect(200);
      await flush();

      // `@Audit({ action })` reemplaza el UPDATE genérico; no lo agrega.
      expect(filas()).toHaveLength(1);
      expect(filas()[0].action).toBe(AuditAction.APPROVE_INSCRIPTION);
      expect(filas()[0].entity).toBe('inscriptions');
      expect(filas()[0].entityId).toBe(INSCRIPTION_ID);
    });

    it('rechazar una inscripción produce UNA fila con REJECT_INSCRIPTION', async () => {
      await patch(`/inscriptions/${INSCRIPTION_ID}/reject`)
        .send({ reason: 'documentación incompleta' })
        .expect(200);
      await flush();

      expect(filas()).toHaveLength(1);
      expect(filas()[0].action).toBe(AuditAction.REJECT_INSCRIPTION);
    });
  });

  // -------------------------------------------------
  // 2. Fail-safe: el default es auditar
  // -------------------------------------------------
  describe('Opt-out: un endpoint sin decorar se audita igual', () => {
    it('audita una escritura que nadie decoró', async () => {
      await post('/sondas/sin-decorador').send({ campo: 'valor' }).expect(201);
      await flush();

      // Esta es la garantía que se perdería con un esquema opt-in: acá el
      // olvido del decorador no produce un agujero silencioso.
      expect(filas()).toHaveLength(1);
      expect(filas()[0].entity).toBe('sondas');
      expect(filas()[0].action).toBe('CREATE');
    });

    it('@NoAudit() excluye, y es la ÚNICA forma de no quedar auditado', async () => {
      await post('/sondas/excluido').expect(201);
      await flush();

      expect(filas()).toHaveLength(0);
    });

    it('@Audit() puede corregir entidad y acción a la vez', async () => {
      await patch('/sondas/accion-de-negocio').expect(200);
      await flush();

      expect(filas()[0]).toMatchObject({
        entity: 'otra_entidad',
        action: 'ACCION_DE_NEGOCIO',
      });
    });
  });

  // -------------------------------------------------
  // 3. Saneamiento profundo de `changes`
  // -------------------------------------------------
  describe('changes no puede llevar secretos ni PII', () => {
    it('redacta secretos anidados y enmascara la PII', async () => {
      await post('/users')
        .send({
          email: 'ana.gomez@juegosevita.gob.ar',
          password: 'Secreta-123',
          firstName: 'Ana',
          // Todo esto pasaba tal cual a la base con el `delete` de primer nivel.
          perfil: {
            dni: '40123456',
            phone: '3814567890',
            credenciales: {
              refreshToken: 'rt-robable',
              apiKey: 'ak-live-123',
              secret: 'shhh',
            },
          },
          contactos: [{ email: 'tutor@gmail.com', token: 'tk-1' }],
        })
        .expect(201);

      await flush();

      const changes = filas()[0].changes;

      // Nada de lo sensible sobrevive, ni siquiera dentro del árbol.
      const serializado = JSON.stringify(changes);
      expect(serializado).not.toContain('Secreta-123');
      expect(serializado).not.toContain('rt-robable');
      expect(serializado).not.toContain('ak-live-123');
      expect(serializado).not.toContain('shhh');
      expect(serializado).not.toContain('tk-1');
      expect(serializado).not.toContain('40123456');
      expect(serializado).not.toContain('ana.gomez@');

      expect(changes.password).toBe(REDACTED);
      expect(changes.perfil.credenciales.refreshToken).toBe(REDACTED);
      expect(changes.perfil.credenciales.apiKey).toBe(REDACTED);
      expect(changes.contactos[0].token).toBe(REDACTED);

      // La PII se enmascara, no se borra: la fila tiene que seguir sirviendo
      // para correlacionar un incidente con una cuenta concreta.
      expect(changes.email).toBe('a***@juegosevita.gob.ar');
      expect(changes.perfil.dni).toBe('******56');

      // R12 — `firstName` pasó a estar clasificado como PII: se conserva la
      // inicial (alcanza para correlacionar filas) y nada más. Hasta R12 esta
      // línea esperaba `'Ana'` en claro, que era el agujero: la fila redactaba
      // la contraseña y a la vez guardaba el nombre completo del chico.
      expect(changes.firstName).toBe('A***');
      expect(JSON.stringify(changes)).not.toContain('Ana');
    });

    it('también sanea los eventos manuales de auth (misma vía, mismo filtro)', async () => {
      await post('/auth/login')
        .send({ email: USER.email, password: 'password-incorrecto' })
        .expect(401);

      await flush();

      const fila = filas()[0];
      expect(fila.action).toBe(AuditAction.LOGIN_FAILED);
      // El email seguía guardándose entero en LOGIN_FAILED.
      expect(fila.changes.email).toBe('d***@juegosevita.gob.ar');
      expect(fila.ipAddress).toBe(IP_CLIENTE);
    });
  });

  // -------------------------------------------------
  // 4. Reuso de refresh token
  // -------------------------------------------------
  describe('Refresh token', () => {
    /** Login y devolución de la cookie de refresh emitida. */
    const login = async (): Promise<string> => {
      const res = await post('/auth/login')
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      return cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`))!;
    };

    it('el reuso de un token ya rotado queda auditado con IP y User-Agent', async () => {
      const cookieVieja = await login();

      // Se simula la rotación poniendo en la base el hash de OTRO token. No se
      // dispara un refresh real porque el JWT se firma con `iat` en segundos:
      // dentro del mismo segundo el token rotado sale idéntico al anterior y el
      // reuso no se distinguiría. Lo que importa acá es el estado resultante:
      // el token que el cliente tiene en la mano ya no es el vigente.
      USER.refreshToken = await argon2.hash('token-vigente-distinto');

      prisma.auditLog.create.mockClear();

      // El atacante (o el usuario con una pestaña vieja) reusa el token viejo.
      await post('/auth/refresh').set('Cookie', cookieVieja).expect(403);
      await flush();

      // Antes de T25 esto era 403 y silencio absoluto en la auditoría.
      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toMatchObject({
        action: AuditAction.REFRESH_TOKEN_REUSE,
        entity: 'User',
        entityId: USER.id,
        ipAddress: IP_CLIENTE,
        userAgent: USER_AGENT,
      });
      expect(filas()[0].changes.sessionsRevoked).toBe(true);
    });

    it('el refresh contra una sesión ya cerrada se distingue del reuso', async () => {
      const cookie = await login();

      // La sesión se cierra por otra vía (logout desde otro dispositivo).
      USER.refreshToken = null;

      prisma.auditLog.create.mockClear();

      await post('/auth/refresh').set('Cookie', cookie).expect(403);
      await flush();

      expect(filas()[0].action).toBe(AuditAction.REFRESH_TOKEN_DENIED);
      expect(filas()[0].changes.reason).toBe('no_active_session');
    });

    it('un refresh exitoso NO genera fila (decisión de volumen)', async () => {
      const cookie = await login();
      prisma.auditLog.create.mockClear();

      await post('/auth/refresh').set('Cookie', cookie).expect(200);
      await flush();

      // Un refresh cada 15 minutos por usuario inundaría la tabla sin agregar
      // información: el inicio de sesión ya quedó registrado en LOGIN.
      expect(filas()).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // 5. Red de seguridad del esquema opt-out
  // -------------------------------------------------
  // -------------------------------------------------
  // R02 — la exclusión de /auth no se puede forzar desde la query
  // -------------------------------------------------
  describe('Bypass de auditoría por querystring (R02)', () => {
    const ID = '55555555-5555-4555-8555-555555555555';

    it('un PATCH con ?x=/auth/ colgado SE audita igual', async () => {
      prisma.auditLog.create.mockClear();

      await patch(`/sondas/${ID}?x=/auth/`).expect(200);
      await flush();

      // El modo de falla original: `request.url` incluye la query, así que
      // `url.includes('/auth/')` daba true y la escritura pasaba sin registrar.
      // Una acción de escritura sin fila es ceguera forense, no ruido de menos.
      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toMatchObject({ entity: 'sondas', entityId: ID });
    });

    it.each([
      ['query', `?x=/auth/`],
      ['query con la ruta entera', `?redirect=/api/v1/auth/login`],
      ['fragmento', `#/auth/`],
      ['mayúsculas en la query', `?x=/AUTH/`],
    ])('tampoco se saltea con %s', async (_caso, sufijo) => {
      prisma.auditLog.create.mockClear();

      await patch(`/sondas/${ID}${sufijo}`).expect(200);
      await flush();

      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toMatchObject({ entity: 'sondas' });
    });

    it('/authors se audita: la exclusión es por segmento, no por substring', async () => {
      prisma.auditLog.create.mockClear();

      await post('/authors').expect(201);
      await flush();

      // El arreglo tenía que cerrar el bypass sin excluir de más. Con
      // `includes('/auth')` esta ruta habría dejado de auditarse.
      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toMatchObject({ entity: 'authors' });
    });

    it('las rutas de auth reales siguen produciendo UNA sola fila', async () => {
      prisma.auditLog.create.mockClear();

      await post('/auth/login')
        .send({ email: USER.email, password: PASSWORD })
        .expect(200);
      await flush();

      // La exclusión existe para que el interceptor no duplique lo que
      // `AuthService` ya audita a mano con su propia acción. Cerrar el bypass
      // no debe reintroducir el doble registro que evitaba.
      const deLogin = filas().filter((f) => f.action === AuditAction.LOGIN);
      expect(deLogin).toHaveLength(1);
      expect(filas()).toHaveLength(1);
    });
  });

  describe('Cobertura de las rutas de escritura reales', () => {
    // RequestMethod de Nest: 1=POST, 2=PUT, 3=DELETE, 4=PATCH.
    const METODOS_DE_ESCRITURA = new Set([1, 2, 3, 4]);

    /**
     * El opt-out no puede dejar un endpoint sin auditar, pero SÍ puede
     * degradarlo: si la URL no empieza con un segmento estable, `parseUrl()`
     * devuelve `unknown` y la fila queda inservible. Este test recorre los
     * controllers reales y falla si eso llegara a pasar, o si alguien marcara
     * un endpoint con `@NoAudit()` sin discutirlo.
     */
    it('ninguna ruta de escritura deriva una entidad inservible ni queda excluida', () => {
      const controllers = [InscriptionsController, UsersController] as Array<
        new (...args: any[]) => object
      >;

      const problemas: string[] = [];

      for (const controller of controllers) {
        const prefijo = Reflect.getMetadata(
          PATH_METADATA,
          controller,
        ) as string;
        const proto = controller.prototype as Record<string, any>;

        for (const nombre of Object.getOwnPropertyNames(proto)) {
          if (nombre === 'constructor') continue;
          const handler = proto[nombre];
          const metodo = Reflect.getMetadata(METHOD_METADATA, handler);
          if (!METODOS_DE_ESCRITURA.has(metodo)) continue;

          const opciones = Reflect.getMetadata(AUDIT_KEY, handler) ?? {};
          const entidad = opciones.entity ?? prefijo.split('/')[0];

          if (opciones.skip) {
            problemas.push(`${controller.name}.${nombre}: marcado @NoAudit()`);
          }
          if (!entidad || entidad === 'unknown') {
            problemas.push(`${controller.name}.${nombre}: entidad inservible`);
          }
        }
      }

      expect(problemas).toEqual([]);
    });
  });
});

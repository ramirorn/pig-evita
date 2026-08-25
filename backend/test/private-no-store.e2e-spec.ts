// ===========================================
// E2E — `no-store` en las respuestas privadas (R16)
// ===========================================
//
// El `CacheControlInterceptor` de T18 hacía media pieza: marcaba `public,
// max-age` los endpoints con `@CacheControl` y **se salteaba** los requests
// autenticados. Saltearse no es prohibir. Sin encabezado, la RFC 9111 §4.2.2
// habilita a cualquier caché intermedia a inventarse una heurística de
// frescura, y el back/forward cache del navegador conserva la pantalla con los
// datos ya renderizados después del logout: se aprieta "atrás" y ahí está el
// listado de participantes de la sesión anterior.
//
// R16 agrega el `no-store` sin tocar la mitad que ya andaba, y eso último es la
// mitad delicada: `test/http-cache.e2e-spec.ts` fija el `public, max-age=600` y
// el `Vary` de los endpoints públicos, y tiene que seguir en verde. Acá se
// vuelve a verificar desde el otro lado.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { ParticipantsController } from '../src/modules/participants/participants.controller';
import { ParticipantsService } from '../src/modules/participants/participants.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { CacheControlInterceptor } from '../src/common/interceptors';
import { GlobalExceptionFilter } from '../src/common/filters';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/database/prisma.service';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const PARTICIPANTE = {
  id: '11111111-1111-4111-8111-111111111111',
  dni: '48123456',
  firstName: 'Juan',
  lastName: 'Pérez',
  locality: 'Clorinda',
  department: 'Pilcomayo',
  inscriptions: [],
  documents: [],
  teamMembers: [],
};

const DISCIPLINAS = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Fútbol',
    isActive: true,
  },
];

describe('Cache-Control en respuestas privadas (R16)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeEach(async () => {
    const prisma = {
      discipline: {
        findMany: jest.fn(() => Promise.resolve(DISCIPLINAS)),
        count: jest.fn(() => Promise.resolve(DISCIPLINAS.length)),
        findUnique: jest.fn(() => Promise.resolve(DISCIPLINAS[0])),
      },
      participant: {
        findMany: jest.fn(() => Promise.resolve([PARTICIPANTE])),
        count: jest.fn(() => Promise.resolve(1)),
        findUnique: jest.fn(({ where }: { where: { id?: string } }) =>
          Promise.resolve(where.id === PARTICIPANTE.id ? PARTICIPANTE : null),
        ),
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...PARTICIPANTE, ...data }),
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [DisciplinesController, ParticipantsController],
      providers: [
        DisciplinesService,
        ParticipantsService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
        // El orden importa: los guards corren antes que los interceptores, y
        // parte de lo que se verifica acá es justamente qué pasa con las
        // respuestas que el guard corta antes de llegar al interceptor.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwt = moduleFixture.get(JwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const token = (role: string = Role.SUPER_ADMIN) =>
    jwt.sign({
      sub: '99999999-9999-4999-8999-999999999999',
      email: 'admin@juegosevita.gob.ar',
      role,
      type: 'access',
    });

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const autenticado = (path: string) =>
    get(path).set('Authorization', `Bearer ${token()}`);

  // -------------------------------------------------
  // El DoD, primera mitad
  // -------------------------------------------------
  describe('con Authorization', () => {
    it('un listado privado sale con no-store', async () => {
      const res = await autenticado('/participants').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('el detalle de un participante también', async () => {
      const res = await autenticado(`/participants/${PARTICIPANTE.id}`).expect(
        200,
      );
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('un endpoint público consultado CON token también: la respuesta es de esa sesión', async () => {
      // Es el caso que más se olvida: `/disciplines` es público y cacheable,
      // pero si el request trae credenciales la respuesta ya no es "la misma
      // para todo el mundo" y un proxy compartido no puede guardarla.
      const res = await autenticado('/disciplines').expect(200);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['cache-control']).not.toContain('public');
      expect(res.headers['cache-control']).not.toContain('max-age');
    });

    it('los errores del handler tampoco se cachean (404)', async () => {
      const res = await autenticado(
        '/participants/22222222-2222-4222-8222-222222222222',
      ).expect(404);

      // Va antes de ejecutar el handler justamente por esto: si el encabezado
      // se pusiera en el `tap` de la respuesta exitosa, todo el camino de error
      // saldría sin marcar.
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('un 401 por token inválido sale con no-store', async () => {
      // Este ni siquiera llega al interceptor: lo corta el `JwtAuthGuard`, que
      // corre antes. Lo cubre el filtro de excepciones.
      const res = await get('/participants')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);

      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('también en los métodos de escritura', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/participants/${PARTICIPANTE.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ phone: '3704999999' })
        .expect(200);

      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  // -------------------------------------------------
  // El DoD, segunda mitad: no romper lo público
  // -------------------------------------------------
  describe('sin Authorization', () => {
    it('el endpoint público con @CacheControl conserva su public/max-age', async () => {
      const res = await get('/disciplines').expect(200);

      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=600');
      expect(res.headers['cache-control']).not.toContain('no-store');
    });

    it('y conserva su Vary', async () => {
      const res = await get('/disciplines').expect(200);
      expect(res.headers['vary']).toContain('Accept-Encoding');
      expect(res.headers['vary']).toContain('Origin');
    });

    it('un endpoint público SIN el decorador sigue sin encabezado', async () => {
      // No se le agrega `no-store` a lo anónimo y sin marcar: sería empeorar el
      // rendimiento de la parte pública del sitio sin proteger nada.
      const res = await get(`/disciplines/${DISCIPLINAS[0].id}`).expect(200);
      expect(res.headers['cache-control']).toBeUndefined();
    });

    it('un 401 anónimo sobre una ruta privada no lleva encabezado de caché', async () => {
      const res = await get('/participants').expect(401);
      expect(res.headers['cache-control']).toBeUndefined();
    });
  });
});

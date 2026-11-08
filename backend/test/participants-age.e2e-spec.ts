// ===========================================
// E2E — La edad del participante se calcula en cada consulta (CA-B1.4, F-04)
// ===========================================
//
// La API no exponía `age`: la UI la calculaba por su cuenta. Ahora el listado,
// el detalle y la búsqueda por DNI devuelven la edad cumplida a la fecha, con
// la misma función (`calcularEdad`) que valida la edad de la categoría.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { ParticipantsController } from '../src/modules/participants/participants.controller';
import { ParticipantsService } from '../src/modules/participants/participants.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/database/prisma.service';
import { ScopeService } from '../src/common/scope';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const HOY = new Date('2026-06-15T12:00:00Z');
const ID = '11111111-1111-4111-8111-111111111111';

/** Cumple 16 el 20 de junio: al 15 de junio todavía tiene 15. */
const sinCumplir = {
  id: ID,
  dni: '48123456',
  firstName: 'Ana',
  lastName: 'Gómez',
  birthDate: new Date('2010-06-20T00:00:00.000Z'),
  department: 'Formosa',
};
/** Cumplió 16 el 10 de junio. */
const yaCumplio = {
  ...sinCumplir,
  id: '22222222-2222-4222-8222-222222222222',
  dni: '48123457',
  birthDate: new Date('2010-06-10T00:00:00.000Z'),
};

describe('Participantes — edad calculada (F-04)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeEach(async () => {
    // Sólo se congela `Date`: los timers reales siguen para que supertest y
    // Nest funcionen normalmente.
    jest.useFakeTimers({
      now: HOY,
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });

    const prisma = {
      participant: {
        findMany: jest.fn(() => Promise.resolve([sinCumplir, yaCumplio])),
        count: jest.fn(() => Promise.resolve(2)),
        findFirst: jest.fn(() => Promise.resolve(sinCumplir)),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [ParticipantsController],
      providers: [
        ScopeService,
        ParticipantsService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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
    jest.useRealTimers();
  });

  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: 'u', email: 'u@t.test', role: Role.ADMIN_PROVINCIAL, type: 'access' })}`,
      );

  it('el detalle expone la edad cumplida a hoy', async () => {
    const res = await get(`/participants/${ID}`).expect(200);
    expect(res.body.age).toBe(15);
  });

  it('el listado expone la edad de cada participante', async () => {
    const res = await get('/participants').expect(200);
    const filas = (res.body.items ?? res.body.data ?? res.body) as Array<{
      id: string;
      age: number;
    }>;
    expect(filas.map((p) => p.age)).toEqual([15, 16]);
  });

  it('la búsqueda por DNI también la expone', async () => {
    const res = await get(`/participants/dni/${sinCumplir.dni}`).expect(200);
    expect(res.body.age).toBe(15);
  });
});

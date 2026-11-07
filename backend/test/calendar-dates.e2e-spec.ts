// ===========================================
// E2E — Calendario: fechas y filtros (auditoría funcional)
// ===========================================
//
// No había ningún e2e del calendario. Se cubren el CRUD público/privado, la
// validación de DTO y el armado del rango de fechas.
// `it.failing` = defecto conocido (F-15 y F-18 de
// documentacion/auditoria-funcional.md) afirmando el comportamiento correcto.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { CalendarController } from '../src/modules/calendar/calendar.controller';
import { CalendarService } from '../src/modules/calendar/calendar.service';
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

describe('Calendario (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let findMany: jest.Mock;
  let create: jest.Mock;

  const auth = (role: Role) => ({
    Authorization: `Bearer ${jwt.sign({ sub: 'u', email: 'u@t.test', role, type: 'access' })}`,
  });

  beforeEach(async () => {
    findMany = jest.fn(() => Promise.resolve([]));
    create = jest.fn((args: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'e1', ...args.data }),
    );
    const prisma = {
      calendarEvent: {
        findMany,
        count: jest.fn(() => Promise.resolve(0)),
        create,
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [CalendarController],
      providers: [
        CalendarService,
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

  const alta = (body: object, rol: Role = Role.ADMIN_PROVINCIAL) =>
    request(app.getHttpServer()).post('/calendar').set(auth(rol)).send(body);

  it('el listado es público', async () => {
    await request(app.getHttpServer()).get('/calendar').expect(200);
  });

  it.each([Role.DELEGADO, Role.ARBITRO, Role.COORDINADOR])(
    '%s no puede crear eventos → 403',
    async (rol) => {
      await alta({ title: 'x', startDate: '2026-12-01T10:00:00Z' }, rol).expect(403);
    },
  );

  it('sin token no se crea → 401', async () => {
    await request(app.getHttpServer())
      .post('/calendar')
      .send({ title: 'x', startDate: '2026-12-01T10:00:00Z' })
      .expect(401);
  });

  it.each([
    [{ title: '', startDate: '2026-12-01T10:00:00Z' }],
    [{ title: 'x' }],
    [{ title: 'x', startDate: 'mañana' }],
    [{ title: 'x', startDate: '2026-12-01T10:00:00Z', stage: 'MUNDIAL' }],
    [{ title: 'x', startDate: '2026-12-01T10:00:00Z', otro: 1 }],
  ])('payload inválido %j → 400', async (mal) => {
    await alta(mal).expect(400);
  });

  it('alta válida → 201', async () => {
    await alta({ title: 'Apertura', startDate: '2026-12-01T10:00:00Z', stage: 'ZONAL' }).expect(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('el rango fromDate/toDate se traduce a gte/lte sobre startDate', async () => {
    await request(app.getHttpServer())
      .get('/calendar?fromDate=2026-12-01T00:00:00Z&toDate=2026-12-31T23:59:59Z')
      .expect(200);
    const where = (findMany.mock.calls[0] as [{ where: { startDate: { gte: Date; lte: Date } } }])[0].where;
    expect(where.startDate.gte).toEqual(new Date('2026-12-01T00:00:00Z'));
    expect(where.startDate.lte).toEqual(new Date('2026-12-31T23:59:59Z'));
  });

  it.failing(
    'F-18: toDate=YYYY-MM-DD debería incluir todo ese día (hoy corta a las 00:00 UTC)',
    async () => {
      await request(app.getHttpServer())
        .get('/calendar?fromDate=2026-12-01&toDate=2026-12-01')
        .expect(200);
      const where = (findMany.mock.calls[0] as [{ where: { startDate: { lte: Date } } }])[0].where;
      expect(where.startDate.lte.getTime()).toBeGreaterThanOrEqual(
        new Date('2026-12-01T23:59:59Z').getTime(),
      );
    },
  );

  it.failing(
    'F-24: venueId/disciplineId que no son UUID deberían rechazarse con 400 (hoy llegan a Prisma y dan 500)',
    async () => {
      await alta({ title: 'x', startDate: '2026-12-01T10:00:00Z', venueId: 'no-uuid' }).expect(400);
    },
  );

  it.failing(
    'F-15: un evento que termina antes de empezar debería rechazarse con 400',
    async () => {
      await alta({
        title: 'Invertido',
        startDate: '2026-12-10T10:00:00Z',
        endDate: '2026-12-01T10:00:00Z',
      }).expect(400);
    },
  );
});

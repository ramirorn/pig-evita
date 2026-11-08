// ===========================================
// E2E — Nadie deja al sistema sin administrador (F-19)
// ===========================================
//
// Un SUPER_ADMIN podía desactivarse (o eliminarse) a sí mismo, y también se
// podía dar de baja al último SUPER_ADMIN activo: la plataforma quedaba sin
// nadie que pudiera gestionar usuarios.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const YO = '11111111-1111-4111-8111-111111111111';
const OTRO_ADMIN = '22222222-2222-4222-8222-222222222222';
const ARBITRO = '33333333-3333-4333-8333-333333333333';

describe('Usuarios — auto-baja y último SUPER_ADMIN (F-19)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let filas: Record<string, { id: string; role: string; isActive: boolean }>;
  let update: jest.Mock;

  beforeEach(async () => {
    filas = {
      [YO]: { id: YO, role: Role.SUPER_ADMIN, isActive: true },
      [OTRO_ADMIN]: { id: OTRO_ADMIN, role: Role.SUPER_ADMIN, isActive: true },
      [ARBITRO]: { id: ARBITRO, role: Role.ARBITRO, isActive: true },
    };
    update = jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        filas[where.id] = { ...filas[where.id], ...data } as never;
        return Promise.resolve(filas[where.id]);
      },
    );
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(filas[where.id] ?? null),
        ),
        findFirst: jest.fn(() => Promise.resolve(null)),
        count: jest.fn(
          ({
            where,
          }: {
            where: { role: string; isActive: boolean; NOT: { id: string } };
          }) =>
            Promise.resolve(
              Object.values(filas).filter(
                (u) =>
                  u.role === where.role &&
                  u.isActive === where.isActive &&
                  u.id !== where.NOT.id,
              ).length,
            ),
        ),
        update,
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [UsersController],
      providers: [
        UsersService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => CONFIG[k]) },
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
  });

  const auth = () => ({
    Authorization: `Bearer ${jwt.sign({ sub: YO, email: 'yo@t.test', role: Role.SUPER_ADMIN, type: 'access' })}`,
  });
  const patch = (id: string, body: object) =>
    request(app.getHttpServer()).patch(`/users/${id}`).set(auth()).send(body);
  const del = (id: string) =>
    request(app.getHttpServer()).delete(`/users/${id}`).set(auth());

  it('no puede desactivarse a sí mismo por PATCH', async () => {
    await patch(YO, { isActive: false }).expect(400);
    expect(filas[YO].isActive).toBe(true);
  });

  it('no puede quitarse el rol de SUPER_ADMIN', async () => {
    await patch(YO, { role: Role.ARBITRO }).expect(400);
    expect(filas[YO].role).toBe(Role.SUPER_ADMIN);
  });

  it('no puede eliminarse a sí mismo', async () => {
    await del(YO).expect(400);
    expect(filas[YO].isActive).toBe(true);
  });

  it('puede editar su propio nombre', async () => {
    await patch(YO, { firstName: 'Nuevo' }).expect(200);
  });

  it('puede dar de baja a otro SUPER_ADMIN mientras quede uno activo', async () => {
    await del(OTRO_ADMIN).expect(200);
    expect(filas[OTRO_ADMIN].isActive).toBe(false);
  });

  it('no puede dar de baja al último SUPER_ADMIN activo', async () => {
    // El actor queda sin rol de SUPER_ADMIN en la "tabla" (el token sigue
    // diciendo SUPER_ADMIN): OTRO_ADMIN pasa a ser el último activo.
    filas[YO].isActive = false;
    await del(OTRO_ADMIN).expect(400);
    await patch(OTRO_ADMIN, { isActive: false }).expect(400);
    expect(filas[OTRO_ADMIN].isActive).toBe(true);
  });

  it('dar de baja a un usuario que no es SUPER_ADMIN sigue funcionando', async () => {
    await patch(ARBITRO, { isActive: false }).expect(200);
    await del(ARBITRO).expect(200);
  });
});

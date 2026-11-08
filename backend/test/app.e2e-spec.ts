// ===========================================
// E2E — Arranque: health check bajo el prefijo global (F-43)
// ===========================================
//
// Reemplaza la prueba plantilla de Nest (`GET /` = "Hello World!"), que fallaba
// con 404 desde siempre. Levantar el `AppModule` entero exige Postgres, Redis y
// MinIO; acá se monta el health check con el mismo prefijo, guard global de
// JWT, interceptor de respuesta y filtro de errores que usa `bootstrap()`, con
// Prisma simulado.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { TransformInterceptor } from '../src/common/interceptors';
import { GlobalExceptionFilter } from '../src/common/filters';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

describe('Arranque de la API (e2e)', () => {
  let app: INestApplication<App>;
  let queryRaw: jest.Mock;

  beforeEach(async () => {
    queryRaw = jest.fn(() => Promise.resolve([{ '?column?': 1 }]));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [HealthController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => CONFIG[k]) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health es público y responde ok con la base arriba', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.data).toMatchObject({
      status: 'ok',
      services: { database: 'up' },
    });
  });

  it('con la base caída responde degraded (no 500)', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.data).toMatchObject({
      status: 'degraded',
      services: { database: 'down' },
    });
  });

  it('una ruta inexistente responde 404 con el formato de error de la API', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/no-existe')
      .expect(404);
    expect(res.body).toMatchObject({ success: false, statusCode: 404 });
  });
});

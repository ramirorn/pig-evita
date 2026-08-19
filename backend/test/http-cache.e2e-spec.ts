// ===========================================
// E2E — compression + Cache-Control (T18 / Q1, Q4, Q7, Q8)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import compression from 'compression';
import http from 'node:http';
import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { CacheControlInterceptor } from '../src/common/interceptors';

/** Payload grande: `compression` no comprime respuestas de menos de 1 KB. */
const DISCIPLINES = Array.from({ length: 40 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  name: `Disciplina de prueba número ${i}`,
  type: 'INDIVIDUAL',
  resultType: 'TIEMPO',
  rules: 'Reglamento de ejemplo repetido para que el JSON tenga volumen. '.repeat(3),
  isActive: true,
}));

let app: INestApplication<App>;

/** Bytes reales que viajan por la red, sin descomprimir. */
async function medirRespuesta(encoding: string): Promise<number> {
  const server = app.getHttpServer() as http.Server;

  if (!server.listening) {
    await new Promise<void>((resolve) => server.listen(0, resolve));
  }
  const { port } = server.address() as { port: number };

  return new Promise((resolve, reject) => {
    http
      .get(
        {
          port,
          path: '/disciplines',
          headers: { 'Accept-Encoding': encoding },
        },
        (res) => {
          let bytes = 0;
          res.on('data', (chunk: Buffer) => (bytes += chunk.length));
          res.on('end', () => resolve(bytes));
        },
      )
      .on('error', reject);
  });
}

describe('Cache HTTP — compression + Cache-Control (e2e)', () => {

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DisciplinesController],
      providers: [
        {
          provide: DisciplinesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              items: DISCIPLINES,
              meta: { total: DISCIPLINES.length, page: 1 },
            }),
            findOne: jest.fn().mockResolvedValue(DISCIPLINES[0]),
            create: jest.fn().mockResolvedValue(DISCIPLINES[0]),
          },
        },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(compression());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------
  // Q1 — compresión
  // -------------------------------------------------
  describe('compression', () => {
    it('comprime la respuesta cuando el cliente acepta gzip', async () => {
      const res = await request(app.getHttpServer())
        .get('/disciplines')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(res.headers['content-encoding']).toBe('gzip');
    });

    it('no comprime si el cliente no lo acepta', async () => {
      const res = await request(app.getHttpServer())
        .get('/disciplines')
        .set('Accept-Encoding', 'identity')
        .expect(200);

      expect(res.headers['content-encoding']).toBeUndefined();
    });

    it('el payload comprimido es sensiblemente más chico', async () => {
      // Se mide con `http` crudo: supertest descomprime en el camino y las
      // respuestas gzip van chunked (sin Content-Length que leer).
      const bytesPlano = await medirRespuesta('identity');
      const bytesGzip = await medirRespuesta('gzip');
      const reduccion = 1 - bytesGzip / bytesPlano;

      console.log(
        `       payload: ${bytesPlano} B -> ${bytesGzip} B (${(reduccion * 100).toFixed(1)}% menos)`,
      );
      expect(reduccion).toBeGreaterThan(0.5);
    });
  });

  // -------------------------------------------------
  // Q4, Q7, Q8 — Cache-Control
  // -------------------------------------------------
  describe('@CacheControl', () => {
    it('marca el listado público como cacheable 10 minutos', async () => {
      const res = await request(app.getHttpServer())
        .get('/disciplines')
        .expect(200);

      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=600');
      expect(res.headers['vary']).toContain('Accept-Encoding');
    });

    it('NO cachea un endpoint sin el decorador', async () => {
      const res = await request(app.getHttpServer())
        .get(`/disciplines/${DISCIPLINES[0].id}`)
        .expect(200);

      expect(res.headers['cache-control']).toBeUndefined();
    });

    it('NO cachea un endpoint mutable', async () => {
      const res = await request(app.getHttpServer())
        .post('/disciplines')
        .send({ name: 'Nueva', type: 'INDIVIDUAL', resultType: 'TIEMPO' })
        .expect(201);

      expect(res.headers['cache-control']).toBeUndefined();
    });

    it('NO cachea si el request llega autenticado', async () => {
      // Aunque el endpoint sea público, un proxy compartido no debe guardar la
      // respuesta de una sesión y servírsela a otra persona.
      const res = await request(app.getHttpServer())
        .get('/disciplines')
        .set('Authorization', 'Bearer un-access-token')
        .expect(200);

      expect(res.headers['cache-control']).toBeUndefined();
    });
  });
});

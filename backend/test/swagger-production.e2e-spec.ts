// ===========================================
// E2E — Swagger oculto en producción (T06 / hallazgo A-02)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupSwagger, SWAGGER_PATH } from '../src/swagger';

/**
 * Controlador mínimo: `setupSwagger` necesita una app con al menos una ruta
 * para escanear, y así el test no depende de Postgres/Redis/MinIO.
 */
@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

/** Levanta una app Nest mínima con Swagger montado según el entorno recibido. */
async function crearApp(
  nodeEnv: string,
): Promise<{ app: INestApplication<App>; montado: boolean }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [PingController],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  const montado = setupSwagger(app, nodeEnv);
  await app.init();

  return { app, montado };
}

describe('Swagger — visibilidad por entorno (e2e)', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('en producción NO monta la documentación: GET /api/docs devuelve 404', async () => {
    const creada = await crearApp('production');
    app = creada.app;

    expect(creada.montado).toBe(false);
    await request(app.getHttpServer()).get(`/${SWAGGER_PATH}`).expect(404);
  });

  it('en producción tampoco expone el JSON de OpenAPI', async () => {
    // El spec crudo filtra el mismo mapa de endpoints que la UI.
    const creada = await crearApp('production');
    app = creada.app;

    await request(app.getHttpServer()).get(`/${SWAGGER_PATH}-json`).expect(404);
  });

  it('la app sigue sirviendo sus rutas normales en producción', async () => {
    // Cortar Swagger no puede llevarse puesto el resto del ruteo.
    const creada = await crearApp('production');
    app = creada.app;

    await request(app.getHttpServer()).get('/ping').expect(200, { ok: true });
  });

  it('en desarrollo la documentación sí está disponible', async () => {
    const creada = await crearApp('development');
    app = creada.app;

    expect(creada.montado).toBe(true);
    const res = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}`)
      .redirects(1);

    expect(res.status).toBe(200);
    // El título real lo inyecta swagger-ui-init.js; en el shell HTML sólo
    // aparece el contenedor de la UI.
    expect(res.text).toContain('swagger-ui');
  });

  it('en desarrollo el JSON de OpenAPI lista los endpoints', async () => {
    const creada = await crearApp('development');
    app = creada.app;

    const res = await request(app.getHttpServer())
      .get(`/${SWAGGER_PATH}-json`)
      .expect(200);

    const body = res.body as {
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(body.info.title).toBe('Juegos Evita Formosa - API');
    expect(Object.keys(body.paths)).toContain('/ping');
  });

  it('un NODE_ENV ausente se trata como desarrollo', async () => {
    // Documenta el comportamiento: el fail-safe lo da el default de config.
    const creada = await crearApp(undefined as unknown as string);
    app = creada.app;

    expect(creada.montado).toBe(true);
  });
});

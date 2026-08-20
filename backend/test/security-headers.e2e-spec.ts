// ===========================================
// E2E — CORS y cabeceras de seguridad (T09 / hallazgos M-02, M-03)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  buildCorsOptions,
  esRutaDeDocs,
  parseCorsOrigins,
  setupSecurity,
} from '../src/security';
import { setupSwagger, SWAGGER_PATH } from '../src/swagger';

const ORIGEN_PERMITIDO = 'https://juegosevita.formosa.gob.ar';
const ORIGEN_HOSTIL = 'https://evil.com';

/** Controlador mínimo: el test no depende de Postgres/Redis/MinIO. */
@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

/**
 * Levanta una app Nest mínima con la seguridad ya cableada, igual que
 * `bootstrap()`. Si se piden docs, se monta Swagger para poder verificar la
 * excepción de CSP sobre una ruta que existe de verdad.
 */
async function crearApp(opciones: {
  nodeEnv: string;
  corsOrigins?: string;
  conDocs?: boolean;
}): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [PingController],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  setupSecurity(app, {
    nodeEnv: opciones.nodeEnv,
    corsOrigins: opciones.corsOrigins ?? ORIGEN_PERMITIDO,
  });
  if (opciones.conDocs) {
    setupSwagger(app, opciones.nodeEnv);
  }
  await app.init();
  return app;
}

describe('Seguridad — CORS y cabeceras (e2e)', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // -------------------------------------------------
  // M-02 — CORS
  // -------------------------------------------------
  describe('CORS', () => {
    it('un Origin no permitido NO recibe Access-Control-Allow-Origin', async () => {
      // DoD literal de la tarea: `curl -H "Origin: https://evil.com"`.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer())
        .get('/ping')
        .set('Origin', ORIGEN_HOSTIL);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('tampoco lo recibe en el preflight', async () => {
      // El preflight es el que realmente decide si el navegador manda el
      // request con credenciales; verificarlo aparte importa.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer())
        .options('/ping')
        .set('Origin', ORIGEN_HOSTIL)
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('el Origin permitido sí lo recibe, con credenciales', async () => {
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer())
        .get('/ping')
        .set('Origin', ORIGEN_PERMITIDO)
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(ORIGEN_PERMITIDO);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('nunca responde con el comodín *', async () => {
      // `*` con `credentials: true` es ilegal y desactivaría toda la política.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer())
        .get('/ping')
        .set('Origin', ORIGEN_HOSTIL);

      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('acepta el segundo dominio de una lista escrita con espacios', async () => {
      // El `split(',')` de config dejaba " https://b..." con espacio adelante y
      // ese origen no matcheaba nunca.
      app = await crearApp({
        nodeEnv: 'production',
        corsOrigins: `${ORIGEN_PERMITIDO}, https://admin.formosa.gob.ar`,
      });

      const res = await request(app.getHttpServer())
        .get('/ping')
        .set('Origin', 'https://admin.formosa.gob.ar')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://admin.formosa.gob.ar',
      );
    });
  });

  describe('parseCorsOrigins', () => {
    it('recorta espacios y descarta entradas vacías', () => {
      expect(parseCorsOrigins('https://a.gob.ar, https://b.gob.ar,')).toEqual([
        'https://a.gob.ar',
        'https://b.gob.ar',
      ]);
    });

    it('acepta el array que ya arma config/index.ts', () => {
      expect(parseCorsOrigins([' https://a.gob.ar '])).toEqual([
        'https://a.gob.ar',
      ]);
    });

    it('una variable vacía o ausente da una lista vacía', () => {
      expect(parseCorsOrigins('')).toEqual([]);
      expect(parseCorsOrigins(undefined)).toEqual([]);
    });
  });

  describe('buildCorsOptions', () => {
    it('falla el arranque en producción si no quedó ningún origen', () => {
      // Agujero que el guardrail de config.validation.ts no tapa:
      // `CORS_ORIGINS=` pasa la validación (no dice "localhost") y dejaba la
      // app arriba con CORS roto.
      expect(() => buildCorsOptions([], 'production')).toThrow(/CORS_ORIGINS/);
    });

    it('en desarrollo una lista vacía no rompe el arranque', () => {
      expect(() => buildCorsOptions([], 'development')).not.toThrow();
    });
  });

  // -------------------------------------------------
  // M-03 — CSP / HSTS
  // -------------------------------------------------
  describe('cabeceras de la API', () => {
    it('emite Content-Security-Policy y Strict-Transport-Security', async () => {
      // DoD literal de la tarea.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);

      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('el CSP de la API cierra todo por defecto', async () => {
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);
      const csp = res.headers['content-security-policy'];

      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'none'");
      expect(csp).toContain("form-action 'none'");
      // Nunca el CSP de la SPA, que habilitaría scripts y estilos.
      expect(csp).not.toContain("'unsafe-inline'");
    });

    it('sólo pide upgrade-insecure-requests en producción', async () => {
      // En desarrollo se sirve por HTTP plano: forzar HTTPS rompería el dev.
      app = await crearApp({ nodeEnv: 'production' });
      const prod = await request(app.getHttpServer()).get('/ping');
      expect(prod.headers['content-security-policy']).toContain(
        'upgrade-insecure-requests',
      );
      await app.close();

      app = await crearApp({ nodeEnv: 'development' });
      const dev = await request(app.getHttpServer()).get('/ping');
      expect(dev.headers['content-security-policy']).not.toContain(
        'upgrade-insecure-requests',
      );
    });

    it('HSTS: un año e incluyendo subdominios, sin preload', async () => {
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);
      const hsts = res.headers['strict-transport-security'];

      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).not.toContain('preload');
    });

    it('emite CORP same-site, no-referrer y nosniff', async () => {
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);

      expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('no filtra la tecnología del servidor', async () => {
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);

      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('también protege las respuestas de error', async () => {
      // Los headers tienen que salir aunque el request no llegue a un handler.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer())
        .get('/ruta-inexistente')
        .expect(404);

      expect(res.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
      expect(res.headers['strict-transport-security']).toBeDefined();
    });
  });

  // -------------------------------------------------
  // Excepción acotada de Swagger
  // -------------------------------------------------
  describe('excepción de CSP para Swagger', () => {
    it('la UI de docs recibe un CSP que la deja funcionar', async () => {
      app = await crearApp({ nodeEnv: 'development', conDocs: true });

      const res = await request(app.getHttpServer())
        .get(`/${SWAGGER_PATH}`)
        .redirects(1);

      expect(res.status).toBe(200);
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      // La excepción no afloja el anti-clickjacking.
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('los assets de swagger-ui también quedan cubiertos', async () => {
      app = await crearApp({ nodeEnv: 'development', conDocs: true });

      const res = await request(app.getHttpServer()).get(
        `/${SWAGGER_PATH}/swagger-ui-init.js`,
      );

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toContain(
        "'unsafe-inline'",
      );
    });

    it('la excepción NO se filtra al resto de la API en desarrollo', async () => {
      app = await crearApp({ nodeEnv: 'development', conDocs: true });

      const res = await request(app.getHttpServer()).get('/ping').expect(200);

      expect(res.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
      expect(res.headers['content-security-policy']).not.toContain(
        "'unsafe-inline'",
      );
    });

    it('en producción /api/docs no existe y cae en el CSP estricto', async () => {
      // Doble red: aunque alguien pegue a la ruta, no hay excepción que aplicar.
      app = await crearApp({ nodeEnv: 'production' });

      const res = await request(app.getHttpServer()).get(`/${SWAGGER_PATH}`);

      expect(res.status).toBe(404);
      expect(res.headers['content-security-policy']).toContain(
        "default-src 'none'",
      );
    });
  });

  describe('esRutaDeDocs', () => {
    it('reconoce la UI, sus assets y el JSON de OpenAPI', () => {
      expect(esRutaDeDocs(`/${SWAGGER_PATH}`)).toBe(true);
      expect(esRutaDeDocs(`/${SWAGGER_PATH}/swagger-ui.css`)).toBe(true);
      expect(esRutaDeDocs(`/${SWAGGER_PATH}-json`)).toBe(true);
      expect(esRutaDeDocs(`/${SWAGGER_PATH}?filter=auth`)).toBe(true);
    });

    it('no confunde rutas que apenas comparten prefijo', () => {
      expect(esRutaDeDocs('/api/documents')).toBe(false);
      expect(esRutaDeDocs('/api/v1/participants')).toBe(false);
      expect(esRutaDeDocs(undefined)).toBe(false);
    });
  });
});

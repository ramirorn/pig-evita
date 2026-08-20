// ===========================================
// Cabeceras de seguridad y CORS (T09 — hallazgos M-02, M-03)
// ===========================================
import type { INestApplication } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import helmet, { type HelmetOptions } from 'helmet';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SWAGGER_PATH, swaggerHabilitado } from './swagger';

/**
 * Vive en su propio archivo (y no inline en `main.ts`) por el mismo motivo que
 * `setupSwagger`: `bootstrap()` levanta el `AppModule` completo (Postgres,
 * Redis, MinIO) y no sería testeable. Con funciones puras + un `setupSecurity`
 * que sólo recibe la app, el e2e monta una app mínima y verifica los headers
 * reales que salen por la red.
 */

// -------------------------------------------------
// CORS
// -------------------------------------------------

/**
 * Normaliza el valor crudo de `CORS_ORIGINS`.
 *
 * `config/index.ts` hace un `split(',')` pelado, así que `"https://a.gov.ar,
 * https://b.gov.ar"` (con el espacio que cualquiera escribe después de la coma)
 * producía el origen `" https://b.gov.ar"`, que jamás matchea contra el header
 * `Origin` del navegador: el segundo dominio quedaba silenciosamente afuera.
 * Por eso acá se recorta y se descartan las entradas vacías (`"a,,b"` o
 * `CORS_ORIGINS=` seteada en blanco).
 */
export function parseCorsOrigins(raw: string | string[] | undefined): string[] {
  const partes = Array.isArray(raw) ? raw : (raw ?? '').split(',');
  return partes.map((o) => o.trim()).filter((o) => o.length > 0);
}

/**
 * Construye las opciones de CORS y falla el arranque si en producción no quedó
 * ningún origen usable.
 *
 * El grueso del hallazgo M-02 lo cubre el `superRefine` de
 * `config.validation.ts`: en producción `CORS_ORIGINS` no puede contener
 * `localhost`, y como el schema le pone `default('http://localhost:5173')`
 * cuando la variable no está, "no setearla" también hace fallar el arranque.
 * Lo que ese guardrail NO tapa es el caso `CORS_ORIGINS=` (definida pero
 * vacía): pasa la validación porque no dice "localhost", y llegaba hasta acá
 * como `['']`, dejando la app arriba con CORS roto para todo el frontend. Se
 * chequea acá, que es donde la lista ya está normalizada.
 */
export function buildCorsOptions(
  origins: string[],
  nodeEnv: string | undefined,
): CorsOptions {
  if (nodeEnv === 'production' && origins.length === 0) {
    throw new Error(
      'CORS_ORIGINS quedó vacía: definí los dominios del frontend separados por coma antes de arrancar en producción.',
    );
  }

  return {
    // Array de strings: el paquete `cors` compara por igualdad exacta y, si el
    // Origin no está en la lista, simplemente NO emite
    // `Access-Control-Allow-Origin`. El navegador se encarga de bloquear la
    // lectura de la respuesta. Nunca se usa el comodín `*`, que además sería
    // ilegal combinado con `credentials: true`.
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Imprescindible para que el navegador mande la cookie del refresh token.
    credentials: true,
    // Lo único que manda el cliente: `Authorization` (access token) y
    // `Content-Type` (JSON y multipart en la subida de documentos). No se
    // agregan headers "por las dudas": cada uno que se suma acá amplía la
    // superficie de lo que un origen permitido puede mandar.
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

// -------------------------------------------------
// Helmet
// -------------------------------------------------

/**
 * HSTS: un año, alineado con lo que ya emite nginx, e incluyendo subdominios.
 *
 * `preload` queda en `false` a propósito: entrar a la lista de precarga de los
 * navegadores es un compromiso prácticamente irreversible que aplica a TODO el
 * dominio raíz y sus subdominios (intranets, sistemas viejos que todavía andan
 * por HTTP). Esa decisión la toma quien administra el dominio de la provincia,
 * no esta API.
 *
 * Se emite también en desarrollo: el header sólo tiene efecto sobre respuestas
 * servidas por HTTPS, así que sobre `http://localhost` los navegadores lo
 * ignoran. Mantenerlo prendido evita que dev y prod diverjan y que el header se
 * "descubra" recién en producción.
 */
const HSTS_OPTIONS = {
  maxAge: 31_536_000, // 1 año, en segundos
  includeSubDomains: true,
  preload: false,
};

/**
 * CSP de la API.
 *
 * Una respuesta JSON no se renderiza nunca como documento: no carga scripts, ni
 * estilos, ni imágenes. Copiar el CSP de la SPA (`default-src 'self'`) sería
 * permitir cosas que esta superficie no necesita. Por eso arranca en
 * `default-src 'none'` y se cierran explícitamente los vectores que igual
 * aplican si alguien logra que el navegador trate una respuesta como HTML
 * (típicamente vía un error renderizado o un endpoint que devuelve texto):
 *
 * - `frame-ancestors 'none'`: nadie puede embeber la API en un iframe
 *   (clickjacking). Es el reemplazo moderno de `X-Frame-Options`.
 * - `base-uri 'none'` y `form-action 'none'`: cortan el secuestro de URLs
 *   relativas y el POST de un formulario inyectado hacia un host atacante.
 * - `upgrade-insecure-requests` sólo en producción: en desarrollo se sirve por
 *   HTTP plano y forzaría al navegador a reescribir a HTTPS pedidos que no
 *   tienen quién los atienda.
 */
function buildApiCsp(nodeEnv: string | undefined) {
  const directives: Record<string, string[]> = {
    'default-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'script-src': ["'none'"],
    'style-src': ["'none'"],
    'img-src': ["'none'"],
    'connect-src': ["'none'"],
    'font-src': ["'none'"],
    'object-src': ["'none'"],
  };

  if (nodeEnv === 'production') {
    // helmet espera un array vacío para las directivas sin valor.
    (directives as Record<string, string[]>)['upgrade-insecure-requests'] = [];
  }

  return { useDefaults: false, directives };
}

/**
 * CSP de la UI de Swagger.
 *
 * Excepción acotada y consciente: swagger-ui inyecta su bootstrap y sus estilos
 * inline, así que con `default-src 'none'` la pantalla queda en blanco. El
 * trade-off se resuelve por ruta y no aflojando la política global: la
 * excepción sólo existe donde swagger-ui vive (`/api/docs`) y sólo en los
 * entornos donde la documentación se monta — en producción `setupSwagger` no
 * registra nada, así que este CSP nunca llega a emitirse ahí.
 *
 * Aun con `'unsafe-inline'`, se mantiene todo lo que no cuesta nada:
 * `frame-ancestors 'none'`, `object-src 'none'` y `connect-src 'self'` (el
 * "Try it out" pega contra esta misma API).
 */
function buildDocsCsp() {
  return {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      // swagger-ui-express arma la configuración en un <script> inline.
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'object-src': ["'none'"],
    },
  };
}

/** Opciones de helmet para las respuestas de la API. */
export function buildApiHelmetOptions(
  nodeEnv: string | undefined,
): HelmetOptions {
  return {
    contentSecurityPolicy: buildApiCsp(nodeEnv),
    strictTransportSecurity: HSTS_OPTIONS,
    // Pedido explícito de la tarea: sólo páginas del mismo sitio pueden cargar
    // estas respuestas como subrecurso (<img>, <script>, etc.). No afecta al
    // frontend: un `fetch` en modo CORS se rige por CORS, no por CORP.
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Una API no debe filtrar la URL desde la que se la llamó.
    referrerPolicy: { policy: 'no-referrer' },
    // Redundante con `frame-ancestors`, pero lo entienden navegadores viejos.
    xFrameOptions: { action: 'deny' },
  };
}

/** Opciones de helmet para la UI de Swagger (sólo fuera de producción). */
export function buildDocsHelmetOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: buildDocsCsp(),
    strictTransportSecurity: HSTS_OPTIONS,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
  };
}

/** ¿La URL pedida pertenece a la UI de Swagger (incluido `/api/docs-json`)? */
export function esRutaDeDocs(url: string | undefined): boolean {
  // Se compara sobre el pathname crudo, sin el prefijo global: Swagger se monta
  // con una ruta absoluta, no bajo `setGlobalPrefix`.
  const pathname = (url ?? '').split('?')[0];
  return (
    pathname === `/${SWAGGER_PATH}` ||
    pathname.startsWith(`/${SWAGGER_PATH}/`) ||
    pathname.startsWith(`/${SWAGGER_PATH}-`)
  );
}

/**
 * Middleware que despacha a uno u otro helmet según la ruta.
 *
 * Se resuelve con un solo `app.use` en vez de dos montajes de Express porque
 * helmet pisa headers: si corrieran los dos, el último ganaría y la excepción
 * de Swagger dejaría de existir (o se comería el CSP estricto de la API).
 */
export function buildHelmetMiddleware(nodeEnv: string | undefined) {
  const helmetApi = helmet(buildApiHelmetOptions(nodeEnv));

  if (!swaggerHabilitado(nodeEnv)) {
    return helmetApi;
  }

  const helmetDocs = helmet(buildDocsHelmetOptions());

  return function helmetPorRuta(
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) {
    return esRutaDeDocs(req.url)
      ? helmetDocs(req, res, next)
      : helmetApi(req, res, next);
  };
}

// -------------------------------------------------
// Wiring
// -------------------------------------------------

/**
 * Aplica helmet y CORS sobre la app. Se llama temprano en `bootstrap()`: helmet
 * tiene que correr antes que cualquier handler para que los headers salgan
 * también en las respuestas de error.
 */
export function setupSecurity(
  app: INestApplication,
  options: {
    nodeEnv: string | undefined;
    corsOrigins: string | string[] | undefined;
  },
): { corsOrigins: string[] } {
  app.use(buildHelmetMiddleware(options.nodeEnv));

  const corsOrigins = parseCorsOrigins(options.corsOrigins);
  app.enableCors(buildCorsOptions(corsOrigins, options.nodeEnv));

  return { corsOrigins };
}

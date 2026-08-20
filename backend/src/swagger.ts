// ===========================================
// Swagger / OpenAPI (T06 — hallazgo A-02)
// ===========================================
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Ruta donde se monta la UI de Swagger. */
export const SWAGGER_PATH = 'api/docs';

/**
 * ¿Se monta la documentación en este entorno?
 *
 * Se exporta aparte porque las cabeceras de seguridad (`security.ts`) necesitan
 * saberlo *antes* de que Swagger se monte, para decidir si hace falta la
 * excepción de CSP de `/api/docs`. Una sola fuente de verdad evita que un día
 * queden desincronizadas.
 */
export function swaggerHabilitado(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

/**
 * Monta Swagger salvo en producción.
 *
 * La documentación expone el mapa completo de endpoints, DTOs y reglas de
 * validación: en producción es reconocimiento gratis para un atacante, así que
 * el bloque entero queda fuera del bootstrap (no basta con protegerlo, no se
 * genera el documento).
 *
 * Vive acá y no inline en `main.ts` porque `bootstrap()` levanta el `AppModule`
 * completo (Postgres, Redis, MinIO) y no sería testeable; con la función
 * exportada el e2e monta una app mínima y verifica los dos escenarios.
 *
 * @returns `true` si se montó, `false` si se omitió por estar en producción.
 */
export function setupSwagger(
  app: INestApplication,
  nodeEnv: string | undefined,
): boolean {
  if (!swaggerHabilitado(nodeEnv)) {
    return false;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Juegos Evita Formosa - API')
    .setDescription(
      'API REST de la Plataforma Integral de Gestión de los Juegos Evita - Secretaría de Deportes de Formosa',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de acceso',
      },
      'access-token',
    )
    .addTag('Health', 'Estado del sistema')
    .addTag('Auth', 'Autenticación y autorización')
    .addTag('Users', 'Gestión de usuarios administrativos')
    .addTag('Participants', 'Gestión de participantes')
    .addTag('Inscriptions', 'Inscripciones')
    .addTag('Disciplines', 'Disciplinas deportivas')
    .addTag('Categories', 'Categorías por disciplina')
    .addTag('Teams', 'Equipos')
    .addTag('Documents', 'Documentación')
    .addTag('Competitions', 'Competencias')
    .addTag('Results', 'Resultados y rankings')
    .addTag('Venues', 'Sedes')
    .addTag('News', 'Noticias')
    .addTag('Calendar', 'Calendario')
    .addTag('Reports', 'Reportes')
    .addTag('Audit', 'Auditoría')
    .addTag('Public', 'Endpoints públicos')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  return true;
}

// ===========================================
// Configuration Validation Schema (Zod)
// ===========================================
import { z } from 'zod';
import {
  buildForbiddenSecretMessage,
  findForbiddenPattern,
} from '../common/security/forbidden-secrets';

/**
 * Variables que transportan un secreto y se validan **en todos los entornos**.
 * `minLength` va acorde a cómo se usa cada una.
 */
const ALWAYS_VALIDATED_SECRETS: Array<{ key: string; minLength: number }> = [
  { key: 'JWT_ACCESS_SECRET', minLength: 32 },
  { key: 'JWT_REFRESH_SECRET', minLength: 32 },
  { key: 'MINIO_ACCESS_KEY', minLength: 8 },
  { key: 'MINIO_SECRET_KEY', minLength: 16 },
  { key: 'SEED_ADMIN_PASSWORD', minLength: 12 },
];

/**
 * Variables que sólo se auditan en producción.
 *
 * `DATABASE_URL` y `REDIS_PASSWORD` apuntan a servicios que en desarrollo corren
 * en contenedores locales sin exponer al exterior, y su contraseña quedó grabada
 * en el volumen de Postgres: cambiarla implica recrear el volumen y perder los
 * datos locales. En producción, en cambio, un default es inaceptable.
 */
const PRODUCTION_ONLY_SECRETS: Array<{ key: string; minLength: number }> = [
  { key: 'DATABASE_URL', minLength: 20 },
  { key: 'REDIS_PASSWORD', minLength: 16 },
];

export const envSchema = z
  .object({
    // App
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(3000),
    API_PREFIX: z.string().default('api/v1'),
    APP_NAME: z.string().default('Juegos Evita Formosa'),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRATION: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRATION: z.string().default('7d'),

    // MinIO
    MINIO_ENDPOINT: z.string().default('localhost'),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: z.string(),
    MINIO_SECRET_KEY: z.string(),
    MINIO_BUCKET: z.string().default('juegos-evita'),
    MINIO_USE_SSL: z
      .string()
      .default('false')
      .transform((val) => val === 'true'),

    // Rate Limiting
    THROTTLE_TTL: z.coerce.number().default(60000),
    THROTTLE_LIMIT: z.coerce.number().default(100),

    // CORS
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

    // Seed
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
  })
  /**
   * Guardrail contra secretos por defecto (hallazgo C-05).
   *
   * Los `.min()` de arriba no alcanzan: `change-me-access-secret-at-least-32-chars`
   * tiene 41 caracteres y pasaba sin problema. Acá se rechaza el *contenido*.
   * Los issues se emiten con `path: [VARIABLE]` para que el mensaje de arranque
   * apunte a la variable exacta.
   */
  .superRefine((env, ctx) => {
    const isProduction = env.NODE_ENV === 'production';

    const toCheck = isProduction
      ? [...ALWAYS_VALIDATED_SECRETS, ...PRODUCTION_ONLY_SECRETS]
      : ALWAYS_VALIDATED_SECRETS;

    for (const { key, minLength } of toCheck) {
      const value = (env as Record<string, unknown>)[key];

      // Las opcionales sin valor no se auditan; su obligatoriedad la definen
      // los `.optional()` de arriba.
      if (typeof value !== 'string' || value.trim() === '') continue;

      const pattern = findForbiddenPattern(value);
      if (pattern) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: buildForbiddenSecretMessage(key, pattern),
        });
        continue;
      }

      if (value.trim().length < minLength) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} debe tener al menos ${minLength} caracteres (tiene ${value.trim().length}).`,
        });
      }
    }

    // En producción, CORS no puede quedar en el default de desarrollo.
    if (isProduction && env.CORS_ORIGINS.includes('localhost')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message:
          'CORS_ORIGINS no puede apuntar a localhost en producción. Definí los dominios reales separados por coma.',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  ${field}: ${messages?.join(', ')}`)
      .join('\n');
    throw new Error(`\n❌ Invalid environment variables:\n${errorMessages}\n`);
  }
  return result.data;
}

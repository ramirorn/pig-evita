// ===========================================
// Guardrails contra secretos por defecto (C-05)
// ===========================================
import { validateEnv } from './config.validation';

/** Entorno mínimo válido: todos los secretos son random, ninguno es default. */
const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://evita_user:l0c4l@localhost:5434/juegos_evita',
  JWT_ACCESS_SECRET: 'BQ8xk2Nf9RtLmYw3bZc8GhdV7pQx2vNfR9tLmYw3bZc',
  JWT_REFRESH_SECRET: 'Zc8GhdV7pQx2vNfR9tLmYw3bZc8GhdV7pQx2vNfR9tL',
  MINIO_ACCESS_KEY: 'evita-minio-79875856cbc5',
  MINIO_SECRET_KEY: 'K7pQx2vNfR9tLmYw3bZc8Ghd',
  SEED_ADMIN_PASSWORD: 'Xk29fR7tLmYw3bZc',
  CORS_ORIGINS: 'http://localhost:5173',
};

/** Defaults que estuvieron realmente en el repo antes de esta tarea. */
const DEFAULTS_HISTORICOS: Array<[string, string]> = [
  ['JWT_ACCESS_SECRET', 'change-me-access-secret-at-least-32-chars'],
  ['JWT_REFRESH_SECRET', 'change-me-refresh-secret-at-least-32-chars'],
  ['MINIO_ACCESS_KEY', 'minioadmin'],
  ['MINIO_SECRET_KEY', 'minioadmin'],
  ['SEED_ADMIN_PASSWORD', 'Admin123!@#'],
];

describe('validateEnv — guardrails de secretos (C-05)', () => {
  it('acepta un entorno con secretos propios', () => {
    expect(() => validateEnv(VALID_ENV)).not.toThrow();
  });

  describe('rechaza los defaults históricos del repo', () => {
    it.each(DEFAULTS_HISTORICOS)(
      '%s = "%s" hace fallar el arranque',
      (key, value) => {
        expect(() => validateEnv({ ...VALID_ENV, [key]: value })).toThrow(key);
      },
    );

    it('el mensaje apunta a la variable y dice cómo generar una nueva', () => {
      let message = '';
      try {
        validateEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: 'change-me-please-32-chars-long-value' });
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).toContain('change-me');
      expect(message).toContain('randomBytes');
    });

    it('nombra todas las variables inválidas, no sólo la primera', () => {
      let message = '';
      try {
        validateEnv({
          ...VALID_ENV,
          JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-chars',
          MINIO_SECRET_KEY: 'minioadmin',
        });
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).toContain('JWT_ACCESS_SECRET');
      expect(message).toContain('MINIO_SECRET_KEY');
    });
  });

  describe('otros patrones prohibidos', () => {
    it.each([
      ['password123456789012345678901234', 'password'],
      ['SuperSecretValueParaElBackend1234', 'secret'],
      ['default-value-para-el-backend-123', 'default'],
      ['qwerty-qwerty-qwerty-qwerty-12345', 'qwerty'],
    ])('rechaza %s', (value) => {
      expect(() =>
        validateEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: value }),
      ).toThrow('JWT_ACCESS_SECRET');
    });

    it('rechaza un secreto corto aunque no sea un default conocido', () => {
      expect(() =>
        validateEnv({ ...VALID_ENV, JWT_ACCESS_SECRET: 'Xk29fR7tLm' }),
      ).toThrow('JWT_ACCESS_SECRET');
    });
  });

  describe('chequeos exclusivos de producción', () => {
    const PROD_ENV = {
      ...VALID_ENV,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://juegosevita.formosa.gob.ar',
      DATABASE_URL: 'postgresql://evita_user:Zc8GhdV7pQx2vNf@db:5432/juegos_evita',
    };

    it('acepta un entorno de producción bien configurado', () => {
      expect(() => validateEnv(PROD_ENV)).not.toThrow();
    });

    it('rechaza la contraseña de base de datos por defecto', () => {
      expect(() =>
        validateEnv({
          ...PROD_ENV,
          DATABASE_URL:
            'postgresql://evita_user:evita_password@db:5432/juegos_evita',
        }),
      ).toThrow('DATABASE_URL');
    });

    it('rechaza CORS apuntando a localhost', () => {
      expect(() =>
        validateEnv({ ...PROD_ENV, CORS_ORIGINS: 'http://localhost:5173' }),
      ).toThrow('CORS_ORIGINS');
    });

    it('en desarrollo tolera la base local y CORS a localhost', () => {
      expect(() =>
        validateEnv({
          ...VALID_ENV,
          DATABASE_URL:
            'postgresql://evita_user:evita_password@localhost:5434/juegos_evita',
        }),
      ).not.toThrow();
    });
  });

  describe('validaciones preexistentes', () => {
    it('sigue exigiendo DATABASE_URL', () => {
      const { DATABASE_URL: _omitida, ...sinDb } = VALID_ENV;
      expect(() => validateEnv(sinDb)).toThrow('DATABASE_URL');
    });

    it('aplica los defaults de las variables opcionales', () => {
      const parsed = validateEnv(VALID_ENV);
      expect(parsed.PORT).toBe(3000);
      expect(parsed.API_PREFIX).toBe('api/v1');
      expect(parsed.JWT_ACCESS_EXPIRATION).toBe('15m');
    });
  });
});

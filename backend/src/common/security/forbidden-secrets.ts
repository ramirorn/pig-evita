// ===========================================
// Secretos por defecto prohibidos (C-05)
// ===========================================

/**
 * Fragmentos que delatan un secreto de plantilla o de ejemplo.
 *
 * La comparación es por *substring* sobre el valor en minúsculas: un secreto
 * generado con `crypto.randomBytes` no contiene ninguna de estas palabras salvo
 * por casualidad astronómica, mientras que los defaults históricos del repo
 * (`change-me-access-secret-at-least-32-chars`, `minioadmin`, `Admin123!@#`)
 * caen todos.
 */
export const FORBIDDEN_SECRET_SUBSTRINGS = [
  'change-me',
  'changeme',
  'cambiame',
  'minioadmin',
  'admin123',
  'password',
  'contrasena',
  'secret',
  'qwerty',
  '123456',
  'default',
  'ejemplo',
  'example',
] as const;

/**
 * Valores que sólo son inseguros si son el secreto **completo**.
 * `admin` como substring es común y legítimo; `admin` como secreto, no.
 */
export const FORBIDDEN_SECRET_EXACT = [
  'admin',
  'root',
  'test',
  'minio',
  'user',
  'postgres',
  'redis',
  'evita',
] as const;

/**
 * Devuelve el patrón prohibido que matchea, o `null` si el valor está limpio.
 */
export function findForbiddenPattern(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return null;

  const exact = FORBIDDEN_SECRET_EXACT.find((word) => normalized === word);
  if (exact) return exact;

  return (
    FORBIDDEN_SECRET_SUBSTRINGS.find((fragment) =>
      normalized.includes(fragment),
    ) ?? null
  );
}

/**
 * Mensaje de error uniforme, con el nombre de la variable y cómo generarla.
 * Que apunte a la variable exacta es parte del DoD de T04.
 */
export function buildForbiddenSecretMessage(
  envVar: string,
  pattern: string,
): string {
  return (
    `${envVar} contiene un valor por defecto ("${pattern}"). ` +
    'Generá uno propio: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64url\'))"'
  );
}

/**
 * Valida un secreto y lanza si es débil o es un default conocido.
 * Se usa fuera de Zod (por ejemplo, en el constructor de `MinioService`).
 */
export function assertStrongSecret(
  envVar: string,
  value: string | undefined,
  minLength = 16,
): asserts value is string {
  const trimmed = (value ?? '').trim();

  if (!trimmed) {
    throw new Error(`❌ ${envVar} no está definida.`);
  }

  const pattern = findForbiddenPattern(trimmed);
  if (pattern) {
    throw new Error(`❌ ${buildForbiddenSecretMessage(envVar, pattern)}`);
  }

  if (trimmed.length < minLength) {
    throw new Error(
      `❌ ${envVar} debe tener al menos ${minLength} caracteres (tiene ${trimmed.length}).`,
    );
  }
}

// ===========================================
// Saneamiento del payload de auditoría (T25 / hallazgo Q10)
// ===========================================

/**
 * La versión anterior de esta lógica vivía dentro del interceptor y hacía tres
 * `delete` sobre el primer nivel del body (`password`, `passwordHash`,
 * `refreshToken`). Eso dejaba pasar todo lo demás:
 *
 *   - cualquier secreto con otro nombre (`token`, `secret`, `apiKey`);
 *   - los mismos campos si venían anidados un nivel más abajo, porque `delete`
 *     no baja por el árbol;
 *   - PII lisa y llana (`dni`, `email`, `phone`) de menores de edad, que es
 *     justamente lo que T01 y T21 sacaron de las respuestas HTTP.
 *
 * `AuditLog` es una tabla de retención larga que consultan perfiles de
 * sistema: era la puerta de atrás por donde volvía a entrar todo lo que se
 * había sacado por la puerta de adelante.
 *
 * Este módulo recorre la estructura completa y aplica dos tratamientos
 * distintos, porque el objetivo de cada uno es distinto:
 *
 *   - SECRETOS  → se reemplazan por `[REDACTED]`. No tienen valor forense:
 *                 saber que "había una contraseña" alcanza y sobra.
 *   - PII       → se enmascara conservando lo mínimo para poder correlacionar
 *                 (`a***@dominio.gob.ar`, `****45`). Borrarla del todo dejaría
 *                 la auditoría inútil: sin poder distinguir un LOGIN_FAILED
 *                 contra una cuenta de otro contra mil cuentas distintas, la
 *                 tabla no sirve para detectar credential stuffing.
 */

export const REDACTED = '[REDACTED]';
const PII_MASK = '[PII]';
const TRUNCATED = '[TRUNCATED]';

/** Profundidad máxima a recorrer; más abajo se corta con `[TRUNCATED]`. */
const MAX_DEPTH = 6;
/** Tope de claves por objeto y de elementos por array. */
const MAX_KEYS = 100;
const MAX_ITEMS = 50;
/** Tope de largo de string, para que un base64 no infle la tabla. */
const MAX_STRING = 512;

/** Normaliza la clave para comparar: `refresh_token`, `Refresh-Token` → `refreshtoken`. */
const normalize = (key: string): string =>
  key.toLowerCase().replace(/[_\-\s]/g, '');

/**
 * Secretos por coincidencia parcial: alcanza con que la clave *contenga* el
 * fragmento. Es deliberadamente agresivo — preferimos redactar de más un campo
 * inocente llamado `tokenCount` que dejar pasar un `csrfToken`.
 */
const SECRET_FRAGMENTS = [
  'password',
  'passwd',
  'token',
  'secret',
  'apikey',
  'authorization',
  'credential',
  'privatekey',
  'sessionid',
  'cookie',
  'signature',
  'otp',
];

/** Secretos por coincidencia exacta (nombres cortos que darían falsos positivos). */
const SECRET_EXACT = new Set(['hash', 'salt', 'pin', 'auth', 'jwt']);

/** PII que se enmascara conservando la cola (documentos, teléfonos). */
const PII_TAIL = new Set([
  'dni',
  'documento',
  'documentnumber',
  'numerodocumento',
  'cuil',
  'cuit',
  'phone',
  'telefono',
  'celular',
]);

/** PII de tipo email. */
const PII_EMAIL = new Set(['email', 'correo', 'mail']);

/** PII que se elimina entera: no aporta nada a la investigación de un incidente. */
const PII_FULL = new Set([
  'address',
  'direccion',
  'birthdate',
  'fechanacimiento',
  'fechadenacimiento',
  'medicalnotes',
  'observacionesmedicas',
]);

type Classification = 'secret' | 'pii-email' | 'pii-tail' | 'pii-full' | 'safe';

function classify(key: string): Classification {
  const k = normalize(key);
  if (SECRET_EXACT.has(k)) return 'secret';
  if (SECRET_FRAGMENTS.some((fragment) => k.includes(fragment)))
    return 'secret';
  if (PII_EMAIL.has(k)) return 'pii-email';
  if (PII_TAIL.has(k)) return 'pii-tail';
  if (PII_FULL.has(k)) return 'pii-full';
  return 'safe';
}

/** `ana.gomez@juegosevita.gob.ar` → `a***@juegosevita.gob.ar`. */
function maskEmail(value: unknown): string {
  if (typeof value !== 'string') return PII_MASK;
  const at = value.indexOf('@');
  if (at <= 0) return PII_MASK;
  // El dominio se conserva entero: no identifica a nadie y sirve para
  // distinguir un ataque contra cuentas internas de uno contra externas.
  return `${value[0]}***${value.slice(at)}`;
}

/** `40123456` → `******56`. Suficiente para cotejar contra un caso concreto. */
function maskTail(value: unknown, keep = 2): string {
  const text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (text.length <= keep) return PII_MASK;
  return `${'*'.repeat(text.length - keep)}${text.slice(-keep)}`;
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…${TRUNCATED}`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  // Funciones y símbolos no deberían llegar acá, pero si llegan no se serializan.
  if (typeof value !== 'object') return String(value);

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[BINARY ${value.length} bytes]`;

  if (depth >= MAX_DEPTH) return TRUNCATED;

  // Referencias circulares: un DTO hidratado por Prisma puede tener padres.
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_ITEMS)
      items.push(`${TRUNCATED} (+${value.length - MAX_ITEMS})`);
    return items;
  }

  return sanitizeObject(value as Record<string, unknown>, depth, seen);
}

function sanitizeObject(
  input: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const keys = Object.keys(input).slice(0, MAX_KEYS);

  for (const key of keys) {
    switch (classify(key)) {
      case 'secret':
        output[key] = REDACTED;
        break;
      case 'pii-email':
        output[key] = maskEmail(input[key]);
        break;
      case 'pii-tail':
        output[key] = maskTail(input[key]);
        break;
      case 'pii-full':
        output[key] = PII_MASK;
        break;
      default:
        output[key] = sanitizeValue(input[key], depth + 1, seen);
    }
  }

  if (Object.keys(input).length > MAX_KEYS) output[TRUNCATED] = true;

  return output;
}

/**
 * Punto de entrada único. Lo usan por igual el `AuditInterceptor` (body de la
 * request) y las llamadas manuales desde `AuthService`: sanear en un solo lugar
 * es lo que evita que una vía quede protegida y la otra no.
 */
export function sanitizeAuditChanges(
  changes: unknown,
): Record<string, unknown> | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes))
    return null;
  return sanitizeObject(changes as Record<string, unknown>, 0, new WeakSet());
}

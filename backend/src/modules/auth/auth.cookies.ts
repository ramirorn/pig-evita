// ===========================================
// Refresh token cookie — configuración centralizada
// ===========================================
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

/**
 * Nombre de la cookie que transporta el refresh token.
 *
 * El refresh token NO viaja en el body ni se guarda en `localStorage`: vive
 * únicamente en esta cookie `httpOnly`, invisible para JavaScript. Es la
 * mitigación del hallazgo C-03 — con el token en `localStorage`, cualquier XSS
 * conseguía una sesión permanente (account takeover).
 */
export const REFRESH_TOKEN_COOKIE = 'evita_refresh_token';

/** Fallback si `JWT_REFRESH_EXPIRATION` no se puede interpretar. */
const DEFAULT_REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

const DURATION_UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Convierte duraciones estilo JWT (`15m`, `7d`, `3600`) a milisegundos.
 * Mantiene la vida de la cookie alineada con la del token que transporta.
 */
export function parseDurationToMs(
  duration?: string,
  fallbackMs: number = DEFAULT_REFRESH_MAX_AGE_MS,
): number {
  if (!duration) return fallbackMs;

  const match = /^(\d+)\s*([smhd])?$/i.exec(String(duration).trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  // Sin unidad, `jsonwebtoken` interpreta segundos.
  return unit ? amount * DURATION_UNITS_MS[unit] : amount * 1000;
}

/** Lo único que se usa del request para decidir `secure`. */
export interface OrigenDeCookie {
  secure?: boolean;
}

/**
 * ¿La cookie se marca `Secure`? (VULN-38)
 *
 * Antes dependía sólo de `NODE_ENV === 'production'`, y el compose de la raíz
 * arranca con `development`: publicado detrás de HTTPS, la cookie de refresh
 * salía sin `Secure`. Ahora alcanza con cualquiera de estas condiciones:
 *
 * - `NODE_ENV=production` (como antes; en producción no se puede apagar).
 * - `COOKIE_SECURE=true`, explícito para cualquier otro entorno publicado.
 * - El request llegó por HTTPS (`req.secure`, que con el `trust proxy` de
 *   `main.ts` respeta el `X-Forwarded-Proto` del proxy de confianza).
 *
 * En desarrollo por HTTP plano sigue sin `Secure`: si no, el navegador no
 * guardaría la cookie y la sesión se cortaría a los 15 minutos.
 */
export function cookieEsSecure(
  configService: ConfigService,
  origen?: OrigenDeCookie,
): boolean {
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const explicita = String(
    configService.get<string>('COOKIE_SECURE') ?? '',
  ).toLowerCase();
  return (
    nodeEnv === 'production' ||
    explicita === 'true' ||
    explicita === '1' ||
    origen?.secure === true
  );
}

/**
 * Opciones de la cookie de refresh.
 *
 * - `httpOnly`: JavaScript no puede leerla (ni `document.cookie` ni un XSS).
 * - `secure`: ver `cookieEsSecure` (VULN-38).
 * - `sameSite: 'strict'`: no se adjunta en navegaciones cross-site (anti-CSRF).
 * - `path`: acotada a los endpoints de auth, así no se envía en cada request
 *   de la API — reduce la exposición de la cookie.
 */
export function buildRefreshCookieOptions(
  configService: ConfigService,
  origen?: OrigenDeCookie,
): CookieOptions {
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const refreshExpiration = configService.get<string>('jwt.refreshExpiration');

  return {
    httpOnly: true,
    secure: cookieEsSecure(configService, origen),
    sameSite: 'strict',
    path: `/${apiPrefix.replace(/^\/+|\/+$/g, '')}/auth`,
    maxAge: parseDurationToMs(refreshExpiration),
  };
}

/**
 * Opciones para borrar la cookie. `clearCookie` sólo la elimina si `path`,
 * `sameSite` y `secure` coinciden con los usados al crearla; `maxAge` sobra.
 */
export function buildClearCookieOptions(
  configService: ConfigService,
  origen?: OrigenDeCookie,
): CookieOptions {
  const { maxAge: _maxAge, ...options } = buildRefreshCookieOptions(
    configService,
    origen,
  );
  return options;
}

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
export function parseDurationToMs(duration?: string): number {
  if (!duration) return DEFAULT_REFRESH_MAX_AGE_MS;

  const match = /^(\d+)\s*([smhd])?$/i.exec(duration.trim());
  if (!match) return DEFAULT_REFRESH_MAX_AGE_MS;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();

  // Sin unidad, `jsonwebtoken` interpreta segundos.
  return unit ? amount * DURATION_UNITS_MS[unit] : amount * 1000;
}

/**
 * Opciones de la cookie de refresh.
 *
 * - `httpOnly`: JavaScript no puede leerla (ni `document.cookie` ni un XSS).
 * - `secure`: sólo por HTTPS en producción (en dev se sirve por HTTP plano).
 * - `sameSite: 'strict'`: no se adjunta en navegaciones cross-site (anti-CSRF).
 * - `path`: acotada a los endpoints de auth, así no se envía en cada request
 *   de la API — reduce la exposición de la cookie.
 */
export function buildRefreshCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const refreshExpiration = configService.get<string>('jwt.refreshExpiration');

  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
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
): CookieOptions {
  const { maxAge: _maxAge, ...options } =
    buildRefreshCookieOptions(configService);
  return options;
}

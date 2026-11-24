// ===========================================
// Auth — constantes de emisión y verificación de tokens
// ===========================================

/**
 * Algoritmo único de firma y verificación (VULN-47).
 *
 * Los secretos son simétricos, así que `jsonwebtoken` 9 ya se limita a la
 * familia HS y rechaza `none`. Fijarlo igual es defensa en profundidad: si un
 * día se pasa a claves asimétricas, ningún token firmado con otro algoritmo
 * (por ejemplo HS512 con el mismo secreto, o RS256 con la clave pública usada
 * como secreto HMAC) se acepta por omisión.
 */
export const JWT_ALGORITHM = 'HS256' as const;

/** Emisor de todos los tokens (claim `iss`). */
export const JWT_ISSUER = 'evita-api';

/** Audiencia del access token (claim `aud`): el cliente web. */
export const JWT_AUDIENCE_ACCESS = 'evita-web';

/**
 * Audiencia del refresh token. Es distinta de la del access token: además del
 * claim `type` y de los secretos separados, un refresh nunca puede pasar por
 * access ni al revés.
 */
export const JWT_AUDIENCE_REFRESH = 'evita-refresh';

/**
 * Vida absoluta de una sesión (VULN-39), contada desde el login y no desde el
 * último refresh. Se puede ajustar con `JWT_SESSION_MAX_AGE` (formato `12h`,
 * `30m`, `86400`).
 */
export const DEFAULT_SESSION_MAX_AGE = '12h';

/**
 * Bloqueo temporal por cuenta (VULN-22): fallos tolerados dentro de la ventana
 * antes de rechazar todo intento para ese email hasta que la ventana venza.
 * Ajustables con `LOGIN_LOCKOUT_MAX_ATTEMPTS` y `LOGIN_LOCKOUT_WINDOW`.
 */
export const DEFAULT_LOGIN_LOCKOUT_MAX_ATTEMPTS = 10;
export const DEFAULT_LOGIN_LOCKOUT_WINDOW = '15m';

/** Vida del access token si `JWT_ACCESS_EXPIRATION` no se puede interpretar. */
export const DEFAULT_ACCESS_EXPIRATION = '15m';

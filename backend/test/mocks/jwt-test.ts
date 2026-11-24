// ===========================================
// Firma de tokens en los tests, igual que la app (VULN-47)
// ===========================================
/**
 * `JwtStrategy` exige `iss` y `aud`. Los specs que firman access tokens a mano
 * registran `JwtModule` con estas opciones, así cada `jwt.sign(...)` sale como
 * lo emite `AuthService` y no hace falta repetirlas en cada llamada.
 */
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE_ACCESS,
  JWT_ISSUER,
} from '../../src/modules/auth/auth.constants';

export const ACCESS_SIGN_OPTIONS = {
  algorithm: JWT_ALGORITHM,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE_ACCESS,
};

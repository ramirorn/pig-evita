// ===========================================
// Emisión de tokens de sesión
// ===========================================
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { JwtPayload } from './interfaces';
import { parseDurationToMs } from './auth.cookies';
import {
  DEFAULT_ACCESS_EXPIRATION,
  JWT_ALGORITHM,
  JWT_AUDIENCE_ACCESS,
  JWT_AUDIENCE_REFRESH,
  JWT_ISSUER,
} from './auth.constants';

/** Vida del refresh si `JWT_REFRESH_EXPIRATION` no está o no se entiende. */
const DEFAULT_REFRESH_EXPIRATION = '7d';

/** Claims de identidad que viajan en los dos tokens. */
export type TokenIdentity = Pick<
  JwtPayload,
  'sub' | 'email' | 'role' | 'department' | 'zone'
>;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Claims de un usuario. R05: el alcance territorial se deriva del token, así
 * que departamento y zona tienen que viajar en él.
 */
export function identityOf(user: {
  id: string;
  email: string;
  role: string;
  department: string | null;
  zone: string | null;
}): TokenIdentity {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    department: user.department,
    zone: user.zone,
  };
}

/**
 * Firma el par access + refresh. Separado de `AuthService`, que decide *cuándo*
 * emitir (login, rotación); acá sólo se decide *cómo*: algoritmo, emisor,
 * audiencias y vencimientos.
 */
@Injectable()
export class AuthTokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** `authTime` es el inicio de la sesión, que se conserva en cada rotación. */
  async issue(
    identity: TokenIdentity,
    authTime: number,
  ): Promise<SessionTokens> {
    // VULN-47 — algoritmo fijo y `iss`/`aud` en ambos tokens; la verificación
    // vive en las estrategias.
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...identity, type: 'access' },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: this.secondsOf(
            'jwt.accessExpiration',
            DEFAULT_ACCESS_EXPIRATION,
          ),
          algorithm: JWT_ALGORITHM,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE_ACCESS,
        },
      ),
      this.jwtService.signAsync(
        // R04 — `jti` único por emisión: sin él, dos refresh del mismo usuario
        // en el mismo segundo salían idénticos y la rotación no rotaba nada.
        // VULN-39 — `auth_time` permite imponer una vida absoluta a la sesión.
        {
          ...identity,
          type: 'refresh',
          jti: randomUUID(),
          auth_time: authTime,
        },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: this.secondsOf(
            'jwt.refreshExpiration',
            DEFAULT_REFRESH_EXPIRATION,
          ),
          algorithm: JWT_ALGORITHM,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE_REFRESH,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Vencimiento en segundos, con el mismo parser que el `maxAge` de la cookie
   * de refresh: así el token y la cookie vencen juntos.
   */
  private secondsOf(key: string, fallback: string): number {
    const ms = parseDurationToMs(
      this.configService.get<string>(key),
      parseDurationToMs(fallback),
    );
    return Math.floor(ms / 1000);
  }
}

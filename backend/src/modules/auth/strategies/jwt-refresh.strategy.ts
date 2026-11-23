// ===========================================
// JWT Refresh Token Strategy
// ===========================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../interfaces';
import { REFRESH_TOKEN_COOKIE } from '../auth.cookies';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE_REFRESH,
  JWT_ISSUER,
} from '../auth.constants';

/**
 * Extrae el refresh token EXCLUSIVAMENTE de la cookie httpOnly.
 *
 * Antes se leía del header `Authorization`, lo que obligaba al cliente a tener
 * el refresh token en JavaScript (y por lo tanto en `localStorage`). Sin
 * fallback al header a propósito: dejarlo mantendría vivo el vector C-03.
 */
function extractRefreshTokenFromCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[REFRESH_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.refreshSecret');

    if (!secret) {
      throw new Error('❌ JWT_REFRESH_SECRET no está definida.');
    }

    super({
      jwtFromRequest: extractRefreshTokenFromCookie,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
      // VULN-47 — algoritmo, emisor y audiencia obligatorios. Los refresh sólo
      // los emite `AuthService`, así que acá no hay tokens legados que tolerar:
      // los emitidos antes del despliegue se rechazan (401) y el usuario vuelve
      // a iniciar sesión una vez.
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_REFRESH,
    });
  }

  validate(
    req: Request,
    payload: JwtPayload,
  ): JwtPayload & { refreshToken: string; authTime: number } {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException(
        'Token inválido: se esperaba un refresh token',
      );
    }

    const refreshToken = extractRefreshTokenFromCookie(req);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      type: payload.type,
      refreshToken,
      // VULN-39 — inicio de la sesión; un token sin `auth_time` cuenta desde
      // su propia emisión.
      authTime:
        payload.auth_time ?? payload.iat ?? Math.floor(Date.now() / 1000),
    };
  }
}

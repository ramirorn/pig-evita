// ===========================================
// JWT Access Token Strategy
// ===========================================
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.accessSecret');

    // Sin fallback: un secreto por defecto permitiría firmar tokens válidos a
    // cualquiera que conozca el código fuente.
    if (!secret) {
      throw new Error('❌ JWT_ACCESS_SECRET no está definida.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (payload.type !== 'access') {
      throw new UnauthorizedException(
        'Token inválido: se esperaba un access token',
      );
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      type: payload.type,
    };
  }
}

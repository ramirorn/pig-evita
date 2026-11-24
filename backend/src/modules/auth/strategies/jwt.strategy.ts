// ===========================================
// JWT Access Token Strategy
// ===========================================
import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE_ACCESS,
  JWT_ISSUER,
} from '../auth.constants';
import { RevocacionSesionesService } from '../session-revocation.service';

/** `aud` puede ser string o lista; vale si incluye la audiencia esperada. */
function audienciaValida(aud: JwtPayload['aud']): boolean {
  if (aud === undefined) return true;
  return Array.isArray(aud)
    ? aud.includes(JWT_AUDIENCE_ACCESS)
    : aud === JWT_AUDIENCE_ACCESS;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    // Opcional para que los módulos de prueba que montan sólo la estrategia
    // sigan levantando; en la app real lo provee `AuthModule`.
    @Optional() private readonly revocaciones?: RevocacionSesionesService,
  ) {
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
      // VULN-47 — sólo el algoritmo con el que se firma.
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException(
        'Token inválido: se esperaba un access token',
      );
    }

    // VULN-47 — mitigación parcial. Todo access token emitido lleva
    // `iss`/`aud`; uno que declare **otro** emisor o audiencia se rechaza. Uno
    // sin esos claims todavía se acepta: los tests e2e de otros módulos firman
    // tokens a mano sin ellos. Exigirlos es cambiar `issuer`/`audience` a
    // obligatorios en `super()` una vez actualizados esos fixtures.
    if (
      (payload.iss !== undefined && payload.iss !== JWT_ISSUER) ||
      !audienciaValida(payload.aud)
    ) {
      throw new UnauthorizedException(
        'Token inválido: emisor o audiencia desconocidos',
      );
    }

    // VULN-05 — un cambio de contraseña, rol, alcance o estado corta también
    // los access tokens ya emitidos, sin esperar a que venzan.
    if (await this.revocaciones?.estaRevocado(payload.sub, payload.iat)) {
      throw new UnauthorizedException(
        'Sesión revocada: inicie sesión nuevamente',
      );
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      // R05 — sin estos dos campos el alcance territorial no se puede derivar
      // del request y todo rol acotado quedaría sin ver nada.
      department: payload.department ?? null,
      zone: payload.zone ?? null,
      type: payload.type,
    };
  }
}

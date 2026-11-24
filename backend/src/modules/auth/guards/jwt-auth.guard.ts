// ===========================================
// JWT Auth Guard (Global)
// ===========================================
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/constants';
import type { JwtPayload } from '../interfaces';

/**
 * Guard global de autenticación JWT.
 * Todas las rutas requieren JWT salvo las marcadas con @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verificar si la ruta está marcada como pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException('No autenticado: token inválido o expirado')
      );
    }
    return user;
  }
}

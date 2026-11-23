// ===========================================
// Roles Guard
// ===========================================
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY, Role } from '../constants';
import { ANY_AUTHENTICATED_KEY } from '../decorators';

/**
 * Guard global de autorización por rol, **deny-by-default** (VULN-45).
 *
 * Cada handler tiene que declarar quién entra:
 *
 * - `@Roles(...ACCIONES.X)`: sólo esos roles.
 * - `@Public()`: cualquiera, sin autenticación.
 * - `@AnyAuthenticated()`: cualquier usuario autenticado, sin importar el rol.
 *
 * Antes, un handler sin `@Roles` dejaba pasar a todo usuario autenticado
 * (incluidos ENTRENADOR y OPERADOR_MESA): un endpoint nuevo al que se le
 * olvidara el decorador quedaba abierto en silencio. Ahora responde 403, y
 * `seguridad-auth-rutas.e2e-spec.ts` recorre todos los controllers para que el
 * olvido se vea en CI.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const objetivos = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      objetivos,
    );
    const { user } = context.switchToHttp().getRequest();

    if (requiredRoles && requiredRoles.length > 0) {
      if (!user) {
        throw new ForbiddenException('Acceso denegado: usuario no autenticado');
      }

      const hasRole = requiredRoles.some((role) => user.role === role);

      if (!hasRole) {
        throw new ForbiddenException(
          'Acceso denegado: no posee los permisos necesarios',
        );
      }

      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, objetivos)) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(
        ANY_AUTHENTICATED_KEY,
        objetivos,
      )
    ) {
      if (!user) {
        throw new ForbiddenException('Acceso denegado: usuario no autenticado');
      }
      return true;
    }

    throw new ForbiddenException(
      'Acceso denegado: la ruta no declara qué roles pueden usarla',
    );
  }
}

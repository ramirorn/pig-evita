// ===========================================
// Custom Decorators
// ===========================================
import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { IS_PUBLIC_KEY, ROLES_KEY, Role } from '../constants';

/**
 * Marca un endpoint como público (sin autenticación JWT).
 * Se usa en endpoints como inscripción por QR o consultas públicas.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Restringe el acceso a los roles indicados.
 * @example @Roles(Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Clave de metadata de `@AnyAuthenticated()`. */
export const ANY_AUTHENTICATED_KEY = 'anyAuthenticated';

/**
 * Habilita la ruta para **cualquier** usuario autenticado, sin importar el rol
 * (VULN-45).
 *
 * `RolesGuard` es deny-by-default: un handler que no declara `@Roles(...)`,
 * `@Public()` ni este decorador responde 403. Así un endpoint nuevo al que se
 * le olvidó el decorador queda cerrado en vez de abierto a todos los roles. Se
 * usa sólo en lo que de verdad es de todos: `/auth/me`, `/auth/permissions` y
 * `/auth/logout`.
 */
export const AnyAuthenticated = () => SetMetadata(ANY_AUTHENTICATED_KEY, true);

/**
 * Extrae el usuario autenticado del request (inyectado por JwtAuthGuard).
 * @example @CurrentUser() user: JwtPayload
 * @example @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

export {
  CacheControl,
  CACHE_CONTROL_KEY,
  CACHE_TTL,
} from './cache-control.decorator';

export {
  PublicReadThrottle,
  PUBLIC_READ_RATE_LIMIT,
  PublicAssetThrottle,
  PUBLIC_ASSET_RATE_LIMIT,
} from './throttle.decorator';

export { Audit, NoAudit, AUDIT_KEY } from './audit.decorator';
export type { AuditOptions } from './audit.decorator';

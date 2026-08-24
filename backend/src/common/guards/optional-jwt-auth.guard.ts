// ===========================================
// Optional JWT Auth Guard
// ===========================================
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Autenticación *opcional* para endpoints públicos que además tienen una vista
 * administrativa (R06).
 *
 * El guard global `JwtAuthGuard` corta antes en cualquier ruta `@Public()`:
 * devuelve `true` sin mirar el header, así que el handler nunca ve un usuario
 * aunque el request traiga un token válido. Eso obliga a elegir entre "público
 * y ciego" o "privado". Para noticias y calendario hace falta lo de en medio:
 * el mismo `GET /news/:id` que sirve la nota publicada al visitante anónimo
 * tiene que devolverle el borrador al editor que lo pide con su token.
 *
 * Este guard se monta a nivel de handler (corre después del global) y populan
 * `request.user` **si** el token es válido. Si no hay token, o está vencido, o
 * es inválido, no rompe: deja el request como anónimo y el service aplica el
 * filtro restrictivo. Nunca concede acceso por sí solo — quien decide qué se
 * ve es el service, con el rol que este guard haya podido probar.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Passport llama acá con `user = false` cuando no pudo autenticar. Devolver
   * `null` en vez de lanzar es lo que convierte el fallo en "anónimo" en lugar
   * de en un 401.
   */
  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
    _info: unknown,
    _context?: ExecutionContext,
  ): TUser | null {
    return user === false || user === undefined ? null : (user as TUser);
  }
}

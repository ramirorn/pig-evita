// ===========================================
// Cache-Control Interceptor
// ===========================================
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_CONTROL_KEY } from '../decorators/cache-control.decorator';

/**
 * ¿El request llega con credenciales? Se mira el header y también `req.user`,
 * que es lo que puebla el guard cuando el token viaja por cookie.
 */
export function esAutenticado(
  request: Pick<Request, 'headers'> & { user?: unknown },
): boolean {
  return Boolean(request.headers?.authorization || request.user);
}

/**
 * Aplica `Cache-Control` a los endpoints marcados con `@CacheControl(n)`.
 *
 * Sin el decorador no toca nada: el resto de la API sigue sin cachearse, que es
 * lo correcto para datos privados o mutables.
 *
 * Tres condiciones se verifican **acá** y no en el decorador, porque dependen
 * del request concreto:
 *
 * 1. Sólo `GET`. Un `POST`/`PATCH` cacheable no tiene sentido.
 * 2. Nunca si el request llega autenticado (header `Authorization` o `req.user`).
 *    Aunque el endpoint sea público, la respuesta podría variar para un usuario
 *    logueado, y `public` habilitaría a un proxy compartido a servírsela a otro.
 * 3. Sólo respuestas exitosas (< 400): un 404 cacheado 10 minutos es una fuente
 *    inagotable de reportes de bugs.
 *
 * R16 — la otra mitad del trabajo: los requests **autenticados** salen con
 * `Cache-Control: no-store`. Que la respuesta no diga nada no significa que no
 * se guarde: sin encabezado, un proxy intermedio puede aplicar su heurística de
 * frescura (RFC 9111 §4.2.2) sobre un `GET /users` o un `GET /inscriptions/:id`,
 * y el back/forward cache del navegador conserva la página con los datos
 * renderizados después del logout. `no-store` es la única directiva que prohíbe
 * escribir la respuesta en cualquier caché, compartida o privada.
 *
 * El encabezado se pone **antes** de ejecutar el handler y no en el `tap`, para
 * que también salga en las respuestas de error del propio handler (un 403 de
 * `RolesGuard` interno, un 404): son las que más chances tienen de no pasar
 * nunca por el camino feliz.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: unknown }>();

    // R16 — privado primero: si el request viene autenticado, la respuesta no
    // se guarda en ningún lado, tenga o no `@CacheControl`. Las dos ramas son
    // excluyentes a propósito, así nunca compiten por el mismo encabezado.
    if (esAutenticado(request)) {
      http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
      return next.handle();
    }

    const maxAge = this.reflector.getAllAndOverride<number | undefined>(
      CACHE_CONTROL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!maxAge || maxAge <= 0) {
      return next.handle();
    }

    if (request.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const response = http.getResponse<Response>();

        if (response.statusCode >= 400) {
          return;
        }

        response.setHeader(
          'Cache-Control',
          `public, max-age=${maxAge}, stale-while-revalidate=${maxAge}`,
        );
        // La respuesta depende del Origin (CORS) y de la codificación
        // negociada; sin esto un proxy podría servir la variante equivocada.
        response.setHeader('Vary', 'Origin, Accept-Encoding');
      }),
    );
  }
}

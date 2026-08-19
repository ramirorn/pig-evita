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
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const maxAge = this.reflector.getAllAndOverride<number | undefined>(
      CACHE_CONTROL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!maxAge || maxAge <= 0) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: unknown }>();

    if (request.method !== 'GET') {
      return next.handle();
    }

    if (request.headers.authorization || request.user) {
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

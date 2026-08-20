// ===========================================
// Audit Interceptor
// ===========================================
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';
import {
  AUDIT_KEY,
  AuditOptions,
} from '../../common/decorators/audit.decorator';

const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra automáticamente las operaciones de escritura (POST, PATCH, PUT,
 * DELETE) que terminan bien.
 *
 * El contrato completo —qué audita esta vía, qué se audita a mano, y por qué
 * el default es auditar en lugar de exigir decorador— está documentado en
 * `common/decorators/audit.decorator.ts`. Leerlo antes de cambiar este
 * archivo.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, ip } = request;

    if (!WRITE_METHODS.includes(method)) {
      return next.handle();
    }

    // Las rutas de auth se auditan a mano en AuthService, con eventos que el
    // interceptor no sabría nombrar (LOGIN_FAILED no es un CREATE). Excluirlas
    // acá es lo que hace que las dos vías sean disjuntas y no haya doble fila.
    if (url.includes('/auth/')) {
      return next.handle();
    }

    // El decorador sólo *refina*: nunca es condición para auditar.
    const options =
      this.reflector.getAllAndOverride<AuditOptions>(AUDIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {};

    if (options.skip) {
      return next.handle();
    }

    const user = (request as any).user;
    const userId = user?.sub ?? null;

    const { entity: entityFromUrl, entityId: entityIdFromUrl } =
      this.parseUrl(url);
    const entity = options.entity ?? entityFromUrl;
    const action = options.action ?? this.methodToAction(method);

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.auditService.log({
            userId,
            action,
            entity,
            // En una creación la URL todavía no tiene el id — el recurso
            // acaba de nacer. Se toma del cuerpo de la respuesta, que es lo
            // que vuelve el controller antes del TransformInterceptor. Sin
            // esto, todo CREATE quedaba con entityId null y era imposible
            // rastrear una entidad concreta por su id en la tabla.
            entityId: entityIdFromUrl ?? this.extractId(data),
            changes: method !== 'DELETE' ? body : null,
            ipAddress: ip,
            userAgent: request.get('User-Agent'),
          });
        },
        error: () => {
          // Los errores no se auditan: la operación no llegó a ocurrir y ya
          // quedan registrados por el exception filter.
        },
      }),
    );
  }

  private methodToAction(method: string): string {
    const map: Record<string, string> = {
      POST: 'CREATE',
      PATCH: 'UPDATE',
      PUT: 'UPDATE',
      DELETE: 'DELETE',
    };
    return map[method] || method;
  }

  /** Saca el id del recurso recién creado, si la respuesta tiene forma de recurso. */
  private extractId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const id = (data as { id?: unknown }).id;
    return typeof id === 'string' && UUID_REGEX.test(id) ? id : null;
  }

  private parseUrl(url: string): { entity: string; entityId: string | null } {
    // Parse: /api/v1/users/uuid → entity: "users", entityId: "uuid"
    // La query string no forma parte de la ruta y confundiría al split.
    const path = url.split('?')[0];
    const parts = path
      .replace(/^\/api\/v1\//, '')
      .split('/')
      .filter(Boolean);
    const entity = parts[0] || 'unknown';

    const entityId = parts.find((p) => UUID_REGEX.test(p)) || null;

    return { entity, entityId };
  }
}

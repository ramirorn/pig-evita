// ===========================================
// Audit Interceptor
// ===========================================
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';

/**
 * Interceptor que registra automáticamente acciones de escritura
 * (POST, PATCH, PUT, DELETE) en la tabla de auditoría.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, ip } = request;

    // Solo auditar operaciones de escritura
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Extraer usuario del request (inyectado por JwtAuthGuard)
    const user = (request as any).user;
    const userId = user?.sub || null;

    // Extraer entidad y entityId de la URL
    const { entity, entityId } = this.parseUrl(url);

    // Determinar acción
    const action = this.methodToAction(method);

    return next.handle().pipe(
      tap({
        next: () => {
          // Solo registrar si no es un login/refresh (esos se auditan en AuthService)
          if (!url.includes('/auth/')) {
            this.auditService.log({
              userId,
              action,
              entity,
              entityId,
              changes: method !== 'DELETE' ? this.sanitizeBody(body) : null,
              ipAddress: ip,
              userAgent: request.get('User-Agent'),
            });
          }
        },
        error: () => {
          // No auditar errores (ya los maneja el exception filter)
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

  private parseUrl(url: string): { entity: string; entityId: string | null } {
    // Parse: /api/v1/users/uuid → entity: "users", entityId: "uuid"
    const parts = url
      .replace(/^\/api\/v1\//, '')
      .split('/')
      .filter(Boolean);
    const entity = parts[0] || 'unknown';

    // UUID pattern
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const entityId = parts.find((p) => uuidRegex.test(p)) || null;

    return { entity, entityId };
  }

  private sanitizeBody(body: any): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;

    // Remover campos sensibles
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.refreshToken;

    return sanitized;
  }
}

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

/** Una misma lectura auditada del mismo usuario se registra una vez por ventana. */
const VENTANA_LECTURA_MS = 10 * 60 * 1000;

/** Lecturas recordadas a lo sumo; pasado el límite se olvidan las más viejas. */
const MAXIMO_LECTURAS_RECORDADAS = 1000;

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
  /** Última vez que se registró cada lectura (usuario + ruta + query). */
  private readonly lecturasRegistradas = new Map<string, number>();

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, ip } = request;

    if (method === 'GET') {
      return this.interceptarLectura(context, next, request);
    }

    if (!WRITE_METHODS.includes(method)) {
      return next.handle();
    }

    // Las rutas de auth se auditan a mano en AuthService, con eventos que el
    // interceptor no sabría nombrar (LOGIN_FAILED no es un CREATE). Excluirlas
    // acá es lo que hace que las dos vías sean disjuntas y no haya doble fila.
    //
    // La comparación va contra la **ruta normalizada**, no contra `url`:
    // `request.url` incluye la query string, así que `url.includes('/auth/')`
    // se satisfacía con un `?x=/auth/` colgado de cualquier PATCH o DELETE y
    // la escritura quedaba sin auditar (R02). Ahora se compara el primer
    // segmento de la ruta por igualdad, lo que además deja de excluir por
    // error rutas como `/authors`.
    if (this.esRutaDeAuth(request)) {
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

    // Acá se parsea la URL real, no el patrón del router: el uuid del recurso
    // está en `/inscriptions/<uuid>/approve` y no en `/inscriptions/:id/approve`.
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

  /**
   * Lecturas decoradas con `lectura: true`: se registra la query string (los
   * filtros consultados), una vez por usuario, ruta y query cada
   * `VENTANA_LECTURA_MS`. Las demás lecturas pasan sin auditar.
   */
  private interceptarLectura(
    context: ExecutionContext,
    next: CallHandler,
    request: Request,
  ): Observable<any> {
    const options =
      this.reflector.getAllAndOverride<AuditOptions>(AUDIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? {};
    if (!options.lectura || options.skip) return next.handle();

    const userId = (request as any).user?.sub ?? null;
    const ruta = request.url.split('?')[0].split('#')[0];
    const query = (request.query ?? {}) as Record<string, unknown>;
    const ordenada = Object.fromEntries(
      Object.keys(query)
        .sort()
        .map((clave) => [clave, query[clave]]),
    );
    const clave = `${userId ?? '-'}|${ruta}|${JSON.stringify(ordenada)}`;
    const { entity, entityId } = this.parseUrl(ruta);

    return next.handle().pipe(
      tap({
        next: () => {
          const ahora = Date.now();
          const anterior = this.lecturasRegistradas.get(clave);
          if (anterior !== undefined && ahora - anterior < VENTANA_LECTURA_MS) {
            return;
          }
          this.recordarLectura(clave, ahora);
          this.auditService.log({
            userId,
            action: options.action ?? 'READ',
            entity: options.entity ?? entity,
            entityId,
            changes: ordenada,
            ipAddress: request.ip,
            userAgent: request.get('User-Agent'),
          });
        },
      }),
    );
  }

  /**
   * Recuerda una lectura sin dejar crecer el mapa: descarta las vencidas y,
   * si aun así está lleno, las más viejas (el `Map` itera por orden de alta).
   * Olvidar una lectura sólo hace que la próxima igual se registre de nuevo.
   */
  private recordarLectura(clave: string, ahora: number): void {
    this.lecturasRegistradas.delete(clave);
    if (this.lecturasRegistradas.size >= MAXIMO_LECTURAS_RECORDADAS) {
      for (const [k, cuando] of this.lecturasRegistradas) {
        if (ahora - cuando >= VENTANA_LECTURA_MS) {
          this.lecturasRegistradas.delete(k);
        }
      }
    }
    for (const k of this.lecturasRegistradas.keys()) {
      if (this.lecturasRegistradas.size < MAXIMO_LECTURAS_RECORDADAS) break;
      this.lecturasRegistradas.delete(k);
    }
    this.lecturasRegistradas.set(clave, ahora);
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

  /**
   * Ruta efectiva del request, sin query string ni fragmento.
   *
   * Se prefiere la ruta del router de Express (`req.baseUrl` + el patrón del
   * handler) porque es la que resolvió el framework y ningún parámetro del
   * cliente puede alterar. `originalUrl`/`url` quedan como respaldo para los
   * casos en que el request no llegó a matchear una ruta.
   */
  private rutaNormalizada(request: Request): string {
    const patron = (request as Request & { route?: { path?: string } }).route
      ?.path;
    const cruda =
      typeof patron === 'string'
        ? `${request.baseUrl ?? ''}${patron}`
        : (request.originalUrl ?? request.url ?? '');

    return cruda.split('?')[0].split('#')[0];
  }

  /** ¿El request cae en el módulo de auth, que se audita a mano? */
  private esRutaDeAuth(request: Request): boolean {
    const { entity } = this.parseUrl(this.rutaNormalizada(request));
    // Igualdad, no `includes`: `/authors` no es `/auth`.
    return entity.toLowerCase() === 'auth';
  }

  private parseUrl(url: string): { entity: string; entityId: string | null } {
    // Parse: /api/v1/users/uuid → entity: "users", entityId: "uuid"
    // La query string y el fragmento no forman parte de la ruta y confundirían
    // al split.
    const path = url.split('?')[0].split('#')[0];
    const parts = path
      .replace(/^\/api\/v\d+\//i, '')
      .split('/')
      .filter(Boolean);
    const entity = parts[0] || 'unknown';

    const entityId = parts.find((p) => UUID_REGEX.test(p)) || null;

    return { entity, entityId };
  }
}

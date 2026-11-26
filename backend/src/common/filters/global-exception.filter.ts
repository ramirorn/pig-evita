// ===========================================
// Global Exception Filter
// ===========================================
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { esAutenticado } from '../interceptors/cache-control.interceptor';
import { urlParaLog } from '../logging/url-para-log';
import {
  ACCESS_DENIED_RECORDER,
  type AccessDeniedRecorder,
  isAuthRoute,
} from '../security/access-denied';

/**
 * Errores de Prisma que significan "la base no está disponible", no un bug:
 * no se pudo conectar (P1001), se agotó el tiempo de conexión (P1002), el
 * servidor cerró la conexión (P1017), se agotó el pool (P2024), o el cliente
 * no pudo inicializarse. Se responden con 503 para que quien opera vea que hay
 * que mirar la base, en vez de un 500 que parece un error de programación.
 */
const CODIGOS_BASE_NO_DISPONIBLE = new Set([
  'P1001',
  'P1002',
  'P1017',
  'P2024',
]);

function esBaseNoDisponible(exception: Error): boolean {
  if (exception.name === 'PrismaClientInitializationError') return true;
  const codigo = (exception as Error & { code?: unknown }).code;
  return (
    exception.name === 'PrismaClientKnownRequestError' &&
    typeof codigo === 'string' &&
    CODIGOS_BASE_NO_DISPONIBLE.has(codigo)
  );
}

/**
 * Qué se escribe en el log de una excepción no controlada (VULN-43): el
 * nombre, el código de Prisma si lo hay y el stack SIN la primera línea. El
 * mensaje no: el de Prisma trae la invocación con los valores de la consulta
 * (un DNI, un email), y el log de aplicación no tiene el control de acceso de
 * la base.
 */
function resumenParaLog(exception: Error): { linea: string; stack?: string } {
  const codigo = (exception as Error & { code?: unknown }).code;
  const linea =
    `Unhandled exception: ${exception.name}` +
    (typeof codigo === 'string' ? ` (${codigo})` : '');
  const stack = exception.stack
    ?.split('\n')
    .filter((l) => l.trimStart().startsWith('at '))
    .join('\n');
  return { linea, stack: stack || undefined };
}

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[] | Record<string, string[]>;
  timestamp: string;
  path: string;
}

/**
 * Error que arma `body-parser` (vía `http-errors`): tiene `status` 4xx,
 * `expose: true` y un `type` como `entity.too.large` o `entity.parse.failed`.
 */
interface ErrorDeBodyParser {
  status: number;
  type?: string;
  expose?: boolean;
}

function esErrorDeBodyParser(
  exception: unknown,
): exception is ErrorDeBodyParser {
  if (typeof exception !== 'object' || exception === null) return false;
  const e = exception as Partial<ErrorDeBodyParser>;
  return (
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.expose === true &&
    typeof e.type === 'string' &&
    e.type.startsWith('entity.')
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /**
   * Opcional: los specs que instancian el filtro con `new` no lo pasan, y sin
   * él el acceso denegado sólo queda en el log.
   */
  constructor(
    @Optional()
    @Inject(ACCESS_DENIED_RECORDER)
    private readonly accessDenied?: AccessDeniedRecorder,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: string[] | Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;

        // class-validator returns an array of messages
        if (Array.isArray(resp.message)) {
          message = 'Error de validación';
          errors = resp.message as string[];
        }
      }
    } else if (esErrorDeBodyParser(exception)) {
      // F-22 — los errores de `body-parser` (body demasiado grande, JSON mal
      // formado, charset no soportado) no son `HttpException`: traen su propio
      // `status` 4xx y caían en la rama del 500. Se respeta ese status y se
      // devuelve un mensaje fijo en castellano en vez del texto de la librería.
      statusCode = exception.status;
      message =
        exception.type === 'entity.too.large'
          ? 'El cuerpo de la petición supera el tamaño máximo permitido'
          : exception.type === 'entity.parse.failed'
            ? 'El cuerpo de la petición no es un JSON válido'
            : 'El cuerpo de la petición no se pudo procesar';
    } else if (exception instanceof Error && esBaseNoDisponible(exception)) {
      const { linea } = resumenParaLog(exception);
      this.logger.error(`${linea}: la base de datos no está disponible`);
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'La base de datos no está disponible en este momento';
    } else if (exception instanceof Error) {
      const { linea, stack } = resumenParaLog(exception);
      this.logger.error(linea, stack);
      // F-01 — el mensaje crudo de una excepción no controlada nunca sale en la
      // respuesta, en ningún entorno: un error de Prisma trae la invocación
      // completa (rutas de `dist/`, número de línea, forma de la consulta) y
      // el stack aislado de pruebas corre con NODE_ENV=development. El detalle
      // queda en el log del servidor, que es donde tiene que estar.
      message = 'Error interno del servidor';
    } else {
      // Se tiró algo que no es un Error (un string, un objeto): antes salía un
      // 500 sin rastro en el log.
      this.logger.error(`Unhandled non-Error exception: ${typeof exception}`);
    }

    // VULN-27 — los accesos denegados quedan en el log (sin token ni datos
    // de la query) para poder ver intentos repetidos de una cuenta o una IP.
    // La retención y las alertas son de la infraestructura de logs
    // (documentacion/seguridad/relevamiento-owasp-2025.md, VULN-27/42).
    if (
      statusCode === HttpStatus.UNAUTHORIZED ||
      statusCode === HttpStatus.FORBIDDEN
    ) {
      const usuario = (request as Request & { user?: { sub?: string } }).user
        ?.sub;
      const ruta = urlParaLog(request.url);
      this.logger.warn(
        `Acceso denegado ${statusCode} ${request.method} ${ruta}` +
          ` usuario=${usuario ?? 'anónimo'} ip=${request.ip ?? '-'}`,
      );
      // Además, a la auditoría (con tope por IP), salvo `/auth/*`, que
      // `AuthService` ya audita con su propia acción.
      if (!isAuthRoute(ruta)) {
        this.accessDenied?.record({
          status: statusCode as 401 | 403,
          method: request.method,
          path: ruta,
          userId: usuario ?? null,
          ipAddress: request.ip ?? null,
          userAgent: request.get?.('user-agent') ?? null,
        });
      }
    }

    // R11 — corte final antes de serializar.
    //
    // El caso que originó esto: `orderBy: { [sortBy]: ... }` con una columna
    // inexistente hace que Prisma tire un `PrismaClientValidationError` cuyo
    // `message` incluye la invocación completa —`C:\...\competitions.service.ts:96`,
    // el fragmento de código y los nombres de las columnas reales—. Eso salía
    // tal cual en el JSON del 500.
    //
    // La whitelist de `sortBy` cierra esa puerta puntual; esto cierra la
    // categoría entera: **ningún 5xx en producción devuelve otra cosa que un
    // mensaje fijo**, venga de donde venga la excepción (incluida una
    // `InternalServerErrorException` que alguien arme con el texto del error
    // adentro). Los detalles quedan en el log del servidor, que es donde tienen
    // que estar.
    if (
      statusCode >= HttpStatus.INTERNAL_SERVER_ERROR &&
      // El 503 lleva siempre un mensaje fijo escrito para el usuario ("la base
      // no está disponible", "el portal no responde"): no trae internos.
      statusCode !== HttpStatus.SERVICE_UNAVAILABLE &&
      process.env.NODE_ENV === 'production'
    ) {
      message = 'Error interno del servidor';
      errors = undefined;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode,
      message,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // R16 — los guards corren **antes** que los interceptores, así que un 401
    // del `JwtAuthGuard` o un 403 del `RolesGuard` nunca pasa por el
    // `CacheControlInterceptor` y saldría sin encabezado de caché. Acá se cierra
    // ese hueco: si el request traía credenciales y nadie puso todavía un
    // `Cache-Control`, se marca `no-store`.
    if (esAutenticado(request) && !response.getHeader('Cache-Control')) {
      response.setHeader('Cache-Control', 'no-store');
    }

    response.status(statusCode).json(errorResponse);
  }
}

// ===========================================
// Global Exception Filter
// ===========================================
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { esAutenticado } from '../interceptors/cache-control.interceptor';

interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[] | Record<string, string[]>;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
      if (process.env.NODE_ENV === 'production') {
        message = 'Error interno del servidor';
      } else {
        message = exception.message;
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

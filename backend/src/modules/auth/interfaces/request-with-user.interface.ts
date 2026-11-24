// ===========================================
// Request autenticado
// ===========================================
import type { Request } from 'express';
import type { JwtPayload } from './jwt-payload.interface';

/**
 * Request de Express después de `JwtStrategy.validate`. `@types/passport` tipa
 * `request.user` como `Express.User`, una interfaz vacía; sin este tipo el
 * código terminaba en `(request as any).user`.
 */
export type RequestWithUser = Request & { user?: JwtPayload };

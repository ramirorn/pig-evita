// ===========================================
// Accesos denegados (VULN-27)
// ===========================================
//
// Puerto entre el filtro global de excepciones (en `common`) y quien guarda el
// evento (la auditoría, en `modules/audit`): el filtro no depende del módulo,
// depende de esta interfaz (DIP). Sin un recorder registrado, el filtro sigue
// funcionando y sólo deja el aviso en el log.

/** Un 401 o 403, sin token ni datos de la query. */
export interface AccessDeniedEvent {
  status: 401 | 403;
  method: string;
  /** Ruta normalizada (`urlParaLog`): sin query string. */
  path: string | undefined;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AccessDeniedRecorder {
  /** Fire-and-forget: nunca demora ni hace fallar la respuesta. */
  record(event: AccessDeniedEvent): void;
}

export const ACCESS_DENIED_RECORDER = Symbol('ACCESS_DENIED_RECORDER');

/**
 * Las rutas de `/auth/*` se auditan a mano en `AuthService` (LOGIN_FAILED,
 * REFRESH_TOKEN_DENIED…): registrarlas acá duplicaría la fila.
 */
export function isAuthRoute(path: string | undefined): boolean {
  return /\/auth(\/|$)/.test(path ?? '');
}

/**
 * Tope de eventos por clave en una ventana fija. Evita que un atacante llene
 * `audit_logs` con 401 en bucle: pasado el tope, el resto de la ventana sólo
 * queda en el log de aplicación. Vive en memoria del proceso: con varias
 * instancias cada una aplica el suyo, que para un tope de escritura alcanza.
 */
export class PerKeyRateCap {
  private readonly windows = new Map<
    string,
    { start: number; count: number }
  >();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    const current = this.windows.get(key);
    if (!current || t - current.start >= this.windowMs) {
      // Al abrir una ventana nueva se descartan las vencidas: el mapa no crece
      // sin límite con IPs que ya no vuelven.
      for (const [k, w] of this.windows) {
        if (t - w.start >= this.windowMs) this.windows.delete(k);
      }
      this.windows.set(key, { start: t, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.max;
  }
}

// ===========================================
// JWT Payload Interface
// ===========================================

export interface JwtPayload {
  /** User ID (UUID) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: string;
  /**
   * Departamento asignado al usuario (R05).
   *
   * Viaja en el token, igual que `role`, y no se relee de la base en cada
   * request: es el mismo dato de identidad, cambia con la misma frecuencia
   * (casi nunca) y tolera la misma ventana de staleness, la vida del access
   * token. La contrapartida honesta: mover a un delegado de departamento recién
   * surte efecto cuando su token se renueva.
   *
   * `null`/ausente significa "sin departamento cargado", y para un rol acotado
   * eso significa que **no ve nada** (ver `common/scope`).
   */
  department?: string | null;
  /** Zona asignada al usuario (R05). Se traduce a departamentos con `zone_departments`. */
  zone?: string | null;
  /** Token type: 'access' | 'refresh' */
  type: 'access' | 'refresh';
}

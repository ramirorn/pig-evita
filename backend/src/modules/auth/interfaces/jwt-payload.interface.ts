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
  /** Token type: 'access' | 'refresh' */
  type: 'access' | 'refresh';
}

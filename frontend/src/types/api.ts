// ===========================================
// Respuestas de la API
// ===========================================
import { UserRole, Sex, InscriptionStatus } from './enums';

// ============ API RESPONSE TYPES ============

/** Paginated response wrapper used by the backend */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Perfil del usuario autenticado, tal como lo devuelve `GET /auth/me`. */
export interface AuthUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

/**
 * Respuesta del login.
 *
 * No incluye `refreshToken` a propósito: viaja en una cookie httpOnly que el
 * navegador administra y JavaScript no puede leer (hallazgo C-03).
 */
export interface AuthResponse {
  accessToken: string;
  user: AuthUserProfile;
}

/** Auth refresh response */
export interface RefreshResponse {
  accessToken: string;
}

/** Dashboard stats response */
/**
 * Fila del donut "Inscripciones por Estado".
 *
 * El backend garantiza que vienen **siempre los 4 estados**, en el orden del
 * enum, con `count: 0` cuando no hay filas. Por eso el front no tiene que
 * completar faltantes ni ordenar: sólo filtrar los ceros para que el gráfico no
 * dibuje porciones invisibles.
 */
export interface DashboardStatusCount {
  status: InscriptionStatus;
  count: number;
}

/**
 * Inscripción tal como la devuelve el widget de recientes.
 *
 * Es un tipo propio y no `Inscription` a propósito: el endpoint del dashboard
 * expone una superficie mínima (sin DNI ni datos de contacto del participante,
 * sin notas internas) porque es un resumen de lectura rápida. Tiparlo como
 * `Inscription` daría a entender que esos campos están disponibles cuando en
 * realidad llegan `undefined`.
 */
export interface DashboardRecentInscription {
  id: string;
  qrCode: string;
  status: InscriptionStatus;
  createdAt: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
  };
  category: {
    id: string;
    name: string;
  };
}

/**
 * Respuesta de `GET /dashboard/stats`.
 *
 * Un único endpoint que reemplaza las 8 requests que hacía el dashboard
 * (hallazgo Q3). El backend la sirve cacheada, así que puede tener hasta 60 s
 * de atraso: `lastUpdated` indica de cuándo son los números.
 */
export interface DashboardStats {
  totalParticipants: number;
  totalTeams: number;
  totalInscriptions: number;
  totalCompetitions: number;
  inscriptionsByStatus: DashboardStatusCount[];
  demographics: Array<{
    sex: Sex;
    count: number;
  }>;
  recentInscriptions: DashboardRecentInscription[];
  lastUpdated: string;
}

/** JWT payload (decoded) */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

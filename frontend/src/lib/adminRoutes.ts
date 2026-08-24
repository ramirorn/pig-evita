// ===========================================
// Rutas del área admin y los roles que las pueden ver
// ===========================================
import { ROUTES } from '@/lib/constants';
import {
  ADMIN_ROLES,
  CATALOG_MANAGERS,
  DASHBOARD_VIEWERS,
  INSCRIPTION_MANAGERS,
  PARTICIPANT_MANAGERS,
  REPORT_VIEWERS,
  RESULT_LOADERS,
  SYSTEM_MANAGERS,
} from '@/lib/roles';
import { UserRole } from '@/types';

/**
 * Única fuente de verdad de "qué rol puede ver qué pantalla del panel".
 *
 * El router la usa para el `allowedRoles` de cada ruta, el `Sidebar` para
 * decidir qué links pinta, el `LoginPage` para elegir a dónde aterriza cada rol
 * y el `DashboardPage` para sus accesos rápidos. Antes cada uno tenía su propia
 * lista y divergían: un `ARBITRO` veía siete links en el menú y seis le
 * respondían "Acceso Denegado".
 *
 * Los grupos de roles siguen viviendo en `@/lib/roles`, espejados de los
 * `@Roles(...)` del backend. Esto es sólo el mapa ruta → grupo.
 *
 * ⚠️ No es un control de seguridad: quien decide es el backend. Esto evita que
 * la pantalla sea alcanzable y que el menú ofrezca caminos cerrados.
 */
export const ADMIN_ROUTE_ROLES = {
  [ROUTES.ADMIN]: DASHBOARD_VIEWERS,
  [ROUTES.DASHBOARD]: DASHBOARD_VIEWERS,
  [ROUTES.PARTICIPANTS]: PARTICIPANT_MANAGERS,
  [ROUTES.PARTICIPANT_DETAIL]: PARTICIPANT_MANAGERS,
  [ROUTES.INSCRIPTIONS]: INSCRIPTION_MANAGERS,
  [ROUTES.INSCRIPTION_DETAIL]: INSCRIPTION_MANAGERS,
  [ROUTES.NEW_INSCRIPTION]: INSCRIPTION_MANAGERS,
  [ROUTES.DISCIPLINES_ADMIN]: CATALOG_MANAGERS,
  [ROUTES.CATEGORIES_ADMIN]: CATALOG_MANAGERS,
  [ROUTES.TEAMS]: PARTICIPANT_MANAGERS,
  [ROUTES.TEAM_DETAIL]: PARTICIPANT_MANAGERS,
  [ROUTES.COMPETITIONS]: ADMIN_ROLES,
  [ROUTES.COMPETITION_DETAIL]: ADMIN_ROLES,
  [ROUTES.RESULTS]: RESULT_LOADERS,
  [ROUTES.DOCUMENTS]: PARTICIPANT_MANAGERS,
  [ROUTES.NEWS_ADMIN]: ADMIN_ROLES,
  [ROUTES.CALENDAR_ADMIN]: ADMIN_ROLES,
  [ROUTES.VENUES_ADMIN]: ADMIN_ROLES,
  [ROUTES.USERS]: SYSTEM_MANAGERS,
  [ROUTES.REPORTS]: REPORT_VIEWERS,
  [ROUTES.AUDIT]: SYSTEM_MANAGERS,
};

/** Cualquiera de las rutas declaradas arriba. */
export type AdminRoutePath = keyof typeof ADMIN_ROUTE_ROLES;

/** ¿Este rol puede entrar a esta pantalla del panel? */
export function puedeVerRuta(role: UserRole, path: AdminRoutePath): boolean {
  return ADMIN_ROUTE_ROLES[path].includes(role);
}

/**
 * Orden de preferencia para el aterrizaje post-login.
 *
 * Se recorre de arriba hacia abajo y gana la primera ruta que el rol pueda ver.
 * El dashboard va primero porque es la pantalla de resumen; un `ARBITRO`, que no
 * lo puede ver, cae en Resultados, que es su única pantalla real.
 */
const ORDEN_ATERRIZAJE: AdminRoutePath[] = [
  ROUTES.DASHBOARD,
  ROUTES.RESULTS,
  ROUTES.INSCRIPTIONS,
  ROUTES.PARTICIPANTS,
  ROUTES.REPORTS,
  ROUTES.COMPETITIONS,
];

/**
 * A dónde mandar a un usuario recién logueado.
 *
 * Devuelve la home pública si el rol no tiene ninguna pantalla del panel
 * (`ENTRENADOR`, `OPERADOR_MESA`): mejor la home que un "Acceso Denegado".
 */
export function rutaInicialPara(role: UserRole): string {
  return ORDEN_ATERRIZAJE.find((path) => puedeVerRuta(role, path)) ?? ROUTES.HOME;
}

/**
 * Busca qué ruta del panel corresponde a un pathname concreto.
 *
 * Compara segmento a segmento y trata los parámetros (`:id`) como comodines, así
 * que `/admin/inscripciones/abc123` resuelve a `ROUTES.INSCRIPTION_DETAIL`.
 * Devuelve `null` si el pathname no pertenece al panel.
 */
export function rutaAdminQueMatchea(pathname: string): AdminRoutePath | null {
  const segmentos = pathname.split('/').filter(Boolean);

  for (const path of Object.keys(ADMIN_ROUTE_ROLES)) {
    if (!esRutaAdmin(path)) continue;
    const patron = path.split('/').filter(Boolean);
    if (patron.length !== segmentos.length) continue;
    const coincide = patron.every(
      (seg, i) => seg.startsWith(':') || seg === segmentos[i],
    );
    if (coincide) return path;
  }

  return null;
}

/** Narrowing sin casts: `Object.keys` devuelve `string[]`. */
function esRutaAdmin(path: string): path is AdminRoutePath {
  return Object.hasOwn(ADMIN_ROUTE_ROLES, path);
}

/**
 * Destino real después del login, respetando la ruta que el usuario intentaba
 * abrir antes de que lo mandaran al login.
 *
 * Si esa ruta pertenece al panel y el rol no la puede ver, se descarta: volver a
 * ella sólo mostraría el cartel de "Acceso Denegado".
 */
export function destinoPostLogin(role: UserRole, intentada?: string): string {
  if (!intentada) return rutaInicialPara(role);

  const ruta = rutaAdminQueMatchea(intentada);
  if (!ruta) {
    // Fuera del panel: no hay nada que validar acá.
    return intentada;
  }

  return puedeVerRuta(role, ruta) ? intentada : rutaInicialPara(role);
}

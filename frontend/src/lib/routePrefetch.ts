// ===========================================
// Prefetch de los chunks de ruta
//
// Al pasar el mouse o enfocar un link de navegación se pide el chunk de la
// página destino, así cuando el usuario hace clic ya está en caché y el
// `lazy()` no muestra el skeleton. Es sólo una pista: si falla se ignora y la
// navegación normal vuelve a intentarlo. Los `import()` apuntan al mismo
// módulo que `@/pages/lazyPages`, así que Vite comparte el chunk.
// ===========================================
import { ROUTES } from '@/lib/constants';

const LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.DISCIPLINES]: () => import('@/pages/public/DisciplinesPage'),
  [ROUTES.NEWS]: () => import('@/pages/public/NewsPage'),
  [ROUTES.CALENDAR]: () => import('@/pages/public/CalendarPage'),
  [ROUTES.VENUES]: () => import('@/pages/public/VenuesPage'),
  [ROUTES.RANKINGS]: () => import('@/pages/public/RankingsPage'),
  [ROUTES.IMPACT_MAP]: () => import('@/pages/public/ImpactMapPage'),
  [ROUTES.DASHBOARD]: () => import('@/pages/admin/DashboardPage'),
  [ROUTES.IMPACT_MAP_ADMIN]: () => import('@/pages/admin/ImpactMapAdminPage'),
  [ROUTES.PARTICIPANTS]: () => import('@/pages/admin/ParticipantsPage'),
  [ROUTES.INSCRIPTIONS]: () => import('@/pages/admin/InscriptionsPage'),
  [ROUTES.NEW_INSCRIPTION]: () => import('@/pages/admin/DelegateInscriptionPage'),
  [ROUTES.DISCIPLINES_ADMIN]: () => import('@/pages/admin/DisciplinesAdminPage'),
  [ROUTES.CATEGORIES_ADMIN]: () => import('@/pages/admin/CategoriesAdminPage'),
  [ROUTES.TEAMS]: () => import('@/pages/admin/TeamsAdminPage'),
  [ROUTES.COMPETITIONS]: () => import('@/pages/admin/CompetitionsPage'),
  [ROUTES.RESULTS]: () => import('@/pages/admin/ResultsPage'),
  [ROUTES.DOCUMENTS]: () => import('@/pages/admin/DocumentsPage'),
  [ROUTES.NEWS_ADMIN]: () => import('@/pages/admin/NewsAdminPage'),
  [ROUTES.CALENDAR_ADMIN]: () => import('@/pages/admin/CalendarAdminPage'),
  [ROUTES.VENUES_ADMIN]: () => import('@/pages/admin/VenuesAdminPage'),
  [ROUTES.SURVEY_ADMIN]: () => import('@/pages/admin/SurveyAdminPage'),
  [ROUTES.USERS]: () => import('@/pages/admin/UsersPage'),
  [ROUTES.REPORTS]: () => import('@/pages/admin/ReportsPage'),
  [ROUTES.AUDIT]: () => import('@/pages/admin/AuditPage'),
};

const pedidos = new Set<string>();

/** Precarga el chunk de `path` (una sola vez); ignora rutas sin loader. */
export function prefetchRoute(path: string): void {
  const cargar = LOADERS[path];
  if (!cargar || pedidos.has(path)) return;
  pedidos.add(path);
  cargar().catch(() => pedidos.delete(path));
}

/** Props para un `<Link>`: precarga al apuntar con el mouse o enfocar con teclado. */
export function prefetchProps(path: string) {
  return {
    onPointerEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
  };
}

// ===========================================
// Prefetch de los chunks de ruta
//
// Al pasar el mouse o enfocar un link de navegación se pide el chunk de la
// página destino, así cuando el usuario hace clic ya está en caché y el
// `lazy()` no muestra el skeleton. Es sólo una pista: si falla se ignora y la
// navegación normal vuelve a intentarlo. Usa el mismo
// `import()` que `@/pages/lazyPages` (los dos salen de `@/pages/pageLoaders`),
// así que Vite comparte el chunk.
// ===========================================
import { ROUTES } from '@/lib/constants';
import { PAGE_LOADERS } from '@/pages/pageLoaders';

const LOADERS: Record<string, () => Promise<unknown>> = {
  [ROUTES.DISCIPLINES]: PAGE_LOADERS.DisciplinesPage,
  [ROUTES.NEWS]: PAGE_LOADERS.NewsPage,
  [ROUTES.CALENDAR]: PAGE_LOADERS.CalendarPage,
  [ROUTES.VENUES]: PAGE_LOADERS.VenuesPage,
  [ROUTES.RANKINGS]: PAGE_LOADERS.RankingsPage,
  [ROUTES.IMPACT_MAP]: PAGE_LOADERS.ImpactMapPage,
  [ROUTES.DASHBOARD]: PAGE_LOADERS.DashboardPage,
  [ROUTES.IMPACT_MAP_ADMIN]: PAGE_LOADERS.ImpactMapAdminPage,
  [ROUTES.PARTICIPANTS]: PAGE_LOADERS.ParticipantsPage,
  [ROUTES.INSCRIPTIONS]: PAGE_LOADERS.InscriptionsPage,
  [ROUTES.NEW_INSCRIPTION]: PAGE_LOADERS.DelegateInscriptionPage,
  [ROUTES.DISCIPLINES_ADMIN]: PAGE_LOADERS.DisciplinesAdminPage,
  [ROUTES.CATEGORIES_ADMIN]: PAGE_LOADERS.CategoriesAdminPage,
  [ROUTES.TEAMS]: PAGE_LOADERS.TeamsAdminPage,
  [ROUTES.COMPETITIONS]: PAGE_LOADERS.CompetitionsPage,
  [ROUTES.RESULTS]: PAGE_LOADERS.ResultsPage,
  [ROUTES.DOCUMENTS]: PAGE_LOADERS.DocumentsPage,
  [ROUTES.NEWS_ADMIN]: PAGE_LOADERS.NewsAdminPage,
  [ROUTES.CALENDAR_ADMIN]: PAGE_LOADERS.CalendarAdminPage,
  [ROUTES.VENUES_ADMIN]: PAGE_LOADERS.VenuesAdminPage,
  [ROUTES.SURVEY_ADMIN]: PAGE_LOADERS.SurveyAdminPage,
  [ROUTES.USERS]: PAGE_LOADERS.UsersPage,
  [ROUTES.REPORTS]: PAGE_LOADERS.ReportsPage,
  [ROUTES.AUDIT]: PAGE_LOADERS.AuditPage,
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

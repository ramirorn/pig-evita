// ===========================================
// Application Router
// ===========================================
import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { ROUTES } from '@/lib/constants';
import { queryClient, STALE_TIME } from '@/lib/queryClient';
import { ADMIN_AREA_ROLES } from '@/lib/roles';
// Qué rol puede ver qué pantalla vive en un solo lugar (R08): el mismo mapa que
// consultan el Sidebar, el redirect post-login y los accesos rápidos del
// dashboard. Antes cada uno tenía su propia lista.
import { ADMIN_ROUTE_ROLES } from '@/lib/adminRoutes';
import type { UserRole } from '@/types';
import { getAccessToken } from '@/api/client';
import { disciplinesApi } from '@/api/disciplines.api';
import { categoriesApi } from '@/api/categories.api';
import { DISCIPLINE_KEYS } from '@/hooks/useDisciplines';
import { CATEGORY_KEYS } from '@/hooks/useCategories';

// Layouts
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary';
import { ErrorScreen } from '@/components/shared/ErrorScreen';
import { PublicPageFallback } from '@/components/shared/PublicPageFallback';

// Auth y páginas de ruta: todas lazy, declaradas en un solo lugar.
// El detalle importante está en el comentario de `@/pages/lazyPages`.
import {
  LoginPage,
  AdminLayout,
  InscriptionInfoPage,
  DisciplinesPage,
  DisciplineDetailPage,
  NewsPage,
  NewsDetailPage,
  CalendarPage,
  VenuesPage,
  RankingsPage,
  CompetitionPublicPage,
  DashboardPage,
  ParticipantsPage,
  ParticipantDetailPage,
  InscriptionsPage,
  InscriptionDetailPage,
  DelegateInscriptionPage,
  DisciplinesAdminPage,
  CategoriesAdminPage,
  TeamsAdminPage,
  TeamDetailPage,
  CompetitionsPage,
  CompetitionDetailPage,
  ResultsPage,
  DocumentsPage,
  NewsAdminPage,
  CalendarAdminPage,
  VenuesAdminPage,
  UsersPage,
  ReportsPage,
  AuditPage,
} from '@/pages/lazyPages';

// La home es la única página que se queda en el chunk de entrada, a propósito.
//
// Medido con `npm run build`: lazificarla saca 2,80 kB gzip del entry (92,53 →
// 89,73). A cambio mete un round-trip extra entre el parseo del entry y el
// primer render —el navegador tiene que descubrir el chunk, pedirlo y recién
// ahí pintar—, que es justo el intervalo que mide el LCP de la ruta de
// aterrizaje del sitio. Cambiar 2,8 kB por una cascada en la primera pintura es
// mal negocio en un móvil formoseño, que es donde la latencia pesa más que los
// bytes.
//
// Las otras ocho públicas se alcanzan navegando, con el entry ya parseado y el
// chunk descargándose mientras el usuario todavía está leyendo: ahí el `lazy()`
// es ganancia neta y por eso sí están en `lazyPages` (R28).
import { HomePage } from '@/pages/public/HomePage';

/**
 * Precarga los catálogos que comparten casi todas las pantallas admin
 * (hallazgo Q14): disciplinas y categorías alimentan combos en formularios,
 * filtros y reportes.
 *
 * No se espera el resultado a propósito — la navegación no debe bloquearse por
 * un prefetch. Con el `staleTime` de catálogo, si ya están frescos
 * `prefetchQuery` no dispara ninguna request.
 */
function prefetchCatalogosAdmin() {
  // Sin sesión, la ruta admin va a redirigir al login: no vale la pena pedir nada.
  if (!getAccessToken()) return null;

  void queryClient.prefetchQuery({
    queryKey: DISCIPLINE_KEYS.list({}),
    queryFn: () => disciplinesApi.findAll({}),
    staleTime: STALE_TIME.CATALOG,
  });

  // Variante que usan los formularios (CategoryForm, TeamForm, CompetitionForm).
  void queryClient.prefetchQuery({
    queryKey: DISCIPLINE_KEYS.list({ isActive: true }),
    queryFn: () => disciplinesApi.findAll({ isActive: true }),
    staleTime: STALE_TIME.CATALOG,
  });

  void queryClient.prefetchQuery({
    queryKey: CATEGORY_KEYS.list({}),
    queryFn: () => categoriesApi.findAll({}),
    staleTime: STALE_TIME.CATALOG,
  });

  return null;
}


/**
 * `<Suspense>` para las rutas que no cuelgan de ningún layout.
 *
 * `PublicLayout` y `AdminLayout` ya envuelven su `<Outlet />`, pero el login y
 * la página de inscripción se montan sueltas: sin este límite, su `lazy()`
 * dispararía el fallback del router entero.
 */
function sinLayout(element: React.ReactNode) {
  return <Suspense fallback={<PublicPageFallback />}>{element}</Suspense>;
}

/**
 * Envuelve el elemento de una ruta con su control de acceso.
 *
 * Cada ruta admin declara explícitamente qué roles la pueden ver (hallazgo F8).
 * El `ProtectedRoute` exterior sólo verifica que el usuario pueda entrar al área;
 * el de acá decide si puede ver *esta* pantalla.
 */
function conRoles(allowedRoles: UserRole[], element: React.ReactNode) {
  return <ProtectedRoute allowedRoles={allowedRoles}>{element}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  // ============ PUBLIC ROUTES ============
  {
    element: <PublicLayout />,
    // Cualquier error dentro de la rama pública (render o loader) se atiende
    // acá; sin esto lo agarra el `DefaultErrorComponent` de react-router, que
    // pinta el stack trace en producción.
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: ROUTES.HOME, element: <HomePage /> },
      { path: ROUTES.DISCIPLINES, element: <DisciplinesPage /> },
      { path: ROUTES.DISCIPLINE_DETAIL, element: <DisciplineDetailPage /> },
      { path: ROUTES.NEWS, element: <NewsPage /> },
      { path: ROUTES.NEWS_DETAIL, element: <NewsDetailPage /> },
      { path: ROUTES.CALENDAR, element: <CalendarPage /> },
      { path: ROUTES.VENUES, element: <VenuesPage /> },
      { path: ROUTES.RANKINGS, element: <RankingsPage /> },
      { path: ROUTES.COMPETITION_PUBLIC, element: <CompetitionPublicPage /> },
      // Comodín: cualquier URL que no matchee arriba muestra el 404 propio con
      // el header y el footer del sitio. Va último a propósito.
      { path: '*', element: <ErrorScreen variant="not-found" fullScreen={false} /> },
    ],
  },

  // ============ INSCRIPTION (standalone info page, no layout) ============
  // Sin layout no hay `<Suspense>` heredado: cada una pone el suyo.
  {
    path: ROUTES.INSCRIPTION,
    element: sinLayout(<InscriptionInfoPage />),
    errorElement: <RouteErrorBoundary />,
  },

  // ============ AUTH ============
  { path: ROUTES.LOGIN, element: sinLayout(<LoginPage />), errorElement: <RouteErrorBoundary /> },

  // ============ ADMIN ROUTES (Protected) ============
  {
    // Primer filtro: ¿puede entrar al área admin? El permiso fino lo pone cada
    // ruta con su propio `allowedRoles`.
    element: (
      <ProtectedRoute allowedRoles={ADMIN_AREA_ROLES}>
        {sinLayout(<AdminLayout />)}
      </ProtectedRoute>
    ),
    // Cubre el fallo de descarga de los chunks lazy de las páginas admin: el
    // `<Suspense>` del AdminLayout espera la promesa, pero no atrapa su rechazo.
    errorElement: <RouteErrorBoundary />,
    loader: prefetchCatalogosAdmin,
    children: [
      { path: ROUTES.ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.ADMIN], <DashboardPage />) },
      { path: ROUTES.DASHBOARD, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.DASHBOARD], <DashboardPage />) },
      { path: ROUTES.PARTICIPANTS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.PARTICIPANTS], <ParticipantsPage />) },
      { path: ROUTES.PARTICIPANT_DETAIL, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.PARTICIPANT_DETAIL], <ParticipantDetailPage />) },
      { path: ROUTES.INSCRIPTIONS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.INSCRIPTIONS], <InscriptionsPage />) },
      { path: ROUTES.INSCRIPTION_DETAIL, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.INSCRIPTION_DETAIL], <InscriptionDetailPage />) },
      { path: ROUTES.NEW_INSCRIPTION, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.NEW_INSCRIPTION], <DelegateInscriptionPage />) },
      { path: ROUTES.DISCIPLINES_ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.DISCIPLINES_ADMIN], <DisciplinesAdminPage />) },
      { path: ROUTES.CATEGORIES_ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.CATEGORIES_ADMIN], <CategoriesAdminPage />) },
      { path: ROUTES.TEAMS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.TEAMS], <TeamsAdminPage />) },
      { path: ROUTES.TEAM_DETAIL, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.TEAM_DETAIL], <TeamDetailPage />) },
      { path: ROUTES.COMPETITIONS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.COMPETITIONS], <CompetitionsPage />) },
      { path: ROUTES.COMPETITION_DETAIL, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.COMPETITION_DETAIL], <CompetitionDetailPage />) },
      { path: ROUTES.RESULTS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.RESULTS], <ResultsPage />) },
      { path: ROUTES.DOCUMENTS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.DOCUMENTS], <DocumentsPage />) },
      { path: ROUTES.NEWS_ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.NEWS_ADMIN], <NewsAdminPage />) },
      { path: ROUTES.CALENDAR_ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.CALENDAR_ADMIN], <CalendarAdminPage />) },
      { path: ROUTES.VENUES_ADMIN, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.VENUES_ADMIN], <VenuesAdminPage />) },
      { path: ROUTES.USERS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.USERS], <UsersPage />) },
      { path: ROUTES.REPORTS, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.REPORTS], <ReportsPage />) },
      { path: ROUTES.AUDIT, element: conRoles(ADMIN_ROUTE_ROLES[ROUTES.AUDIT], <AuditPage />) },
      // 404 del área admin: se resuelve dentro del layout, con el sidebar puesto.
      { path: '/admin/*', element: <ErrorScreen variant="not-found" fullScreen={false} /> },
    ],
  },
]);

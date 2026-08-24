// ===========================================
// Application Router
// ===========================================
import { lazy } from 'react';
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
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { RouteErrorBoundary } from '@/components/shared/RouteErrorBoundary';
import { ErrorScreen } from '@/components/shared/ErrorScreen';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';

// Public pages
import { HomePage } from '@/pages/public/HomePage';
import { InscriptionInfoPage } from '@/pages/public/InscriptionInfoPage';
import {
  DisciplinesPage,
  DisciplineDetailPage,
  NewsPage,
  NewsDetailPage,
  CalendarPage,
  VenuesPage,
  RankingsPage,
  CompetitionPublicPage,
} from '@/pages/public/index';

// ============ ADMIN PAGES (lazy) ============
// Se importan una por una desde su archivo, no desde el barrel: importar
// `@/pages/admin/index` arrastraría las 20 páginas al mismo chunk y anularía
// el split. Cada `lazy()` produce un chunk propio que sólo se descarga al
// entrar a esa ruta (hallazgo Q6).
const DashboardPage = lazy(() =>
  import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ParticipantsPage = lazy(() =>
  import('@/pages/admin/ParticipantsPage').then((m) => ({ default: m.ParticipantsPage })),
);
const ParticipantDetailPage = lazy(() =>
  import('@/pages/admin/ParticipantDetailPage').then((m) => ({ default: m.ParticipantDetailPage })),
);
const InscriptionsPage = lazy(() =>
  import('@/pages/admin/InscriptionsPage').then((m) => ({ default: m.InscriptionsPage })),
);
const InscriptionDetailPage = lazy(() =>
  import('@/pages/admin/InscriptionDetailPage').then((m) => ({ default: m.InscriptionDetailPage })),
);
const DelegateInscriptionPage = lazy(() =>
  import('@/pages/admin/DelegateInscriptionPage').then((m) => ({ default: m.DelegateInscriptionPage })),
);
const DisciplinesAdminPage = lazy(() =>
  import('@/pages/admin/DisciplinesAdminPage').then((m) => ({ default: m.DisciplinesAdminPage })),
);
const CategoriesAdminPage = lazy(() =>
  import('@/pages/admin/CategoriesAdminPage').then((m) => ({ default: m.CategoriesAdminPage })),
);
const TeamsAdminPage = lazy(() =>
  import('@/pages/admin/TeamsAdminPage').then((m) => ({ default: m.TeamsAdminPage })),
);
const TeamDetailPage = lazy(() =>
  import('@/pages/admin/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })),
);
const CompetitionsPage = lazy(() =>
  import('@/pages/admin/CompetitionsPage').then((m) => ({ default: m.CompetitionsPage })),
);
const CompetitionDetailPage = lazy(() =>
  import('@/pages/admin/CompetitionDetailPage').then((m) => ({ default: m.CompetitionDetailPage })),
);
const ResultsPage = lazy(() =>
  import('@/pages/admin/ResultsPage').then((m) => ({ default: m.ResultsPage })),
);
const DocumentsPage = lazy(() =>
  import('@/pages/admin/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const NewsAdminPage = lazy(() =>
  import('@/pages/admin/NewsAdminPage').then((m) => ({ default: m.NewsAdminPage })),
);
const CalendarAdminPage = lazy(() =>
  import('@/pages/admin/CalendarAdminPage').then((m) => ({ default: m.CalendarAdminPage })),
);
const VenuesAdminPage = lazy(() =>
  import('@/pages/admin/VenuesAdminPage').then((m) => ({ default: m.VenuesAdminPage })),
);
const UsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const AuditPage = lazy(() =>
  import('@/pages/admin/AuditPage').then((m) => ({ default: m.AuditPage })),
);


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
  { path: ROUTES.INSCRIPTION, element: <InscriptionInfoPage />, errorElement: <RouteErrorBoundary /> },

  // ============ AUTH ============
  { path: ROUTES.LOGIN, element: <LoginPage />, errorElement: <RouteErrorBoundary /> },

  // ============ ADMIN ROUTES (Protected) ============
  {
    // Primer filtro: ¿puede entrar al área admin? El permiso fino lo pone cada
    // ruta con su propio `allowedRoles`.
    element: (
      <ProtectedRoute allowedRoles={ADMIN_AREA_ROLES}>
        <AdminLayout />
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

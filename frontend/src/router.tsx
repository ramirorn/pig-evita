// ===========================================
// Application Router
// ===========================================
import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';
import { ROUTES } from '@/lib/constants';
import { queryClient, STALE_TIME } from '@/lib/queryClient';
import { getAccessToken } from '@/api/client';
import { disciplinesApi } from '@/api/disciplines.api';
import { categoriesApi } from '@/api/categories.api';
import { DISCIPLINE_KEYS } from '@/hooks/useDisciplines';
import { CATEGORY_KEYS } from '@/hooks/useCategories';

// Layouts
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

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

export const router = createBrowserRouter([
  // ============ PUBLIC ROUTES ============
  {
    element: <PublicLayout />,
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
    ],
  },

  // ============ INSCRIPTION (standalone info page, no layout) ============
  { path: ROUTES.INSCRIPTION, element: <InscriptionInfoPage /> },

  // ============ AUTH ============
  { path: ROUTES.LOGIN, element: <LoginPage /> },

  // ============ ADMIN ROUTES (Protected) ============
  {
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    loader: prefetchCatalogosAdmin,
    children: [
      { path: ROUTES.ADMIN, element: <DashboardPage /> },
      { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
      { path: ROUTES.PARTICIPANTS, element: <ParticipantsPage /> },
      { path: ROUTES.PARTICIPANT_DETAIL, element: <ParticipantDetailPage /> },
      { path: ROUTES.INSCRIPTIONS, element: <InscriptionsPage /> },
      { path: ROUTES.INSCRIPTION_DETAIL, element: <InscriptionDetailPage /> },
      { path: ROUTES.NEW_INSCRIPTION, element: <DelegateInscriptionPage /> },
      { path: ROUTES.DISCIPLINES_ADMIN, element: <DisciplinesAdminPage /> },
      { path: ROUTES.CATEGORIES_ADMIN, element: <CategoriesAdminPage /> },
      { path: ROUTES.TEAMS, element: <TeamsAdminPage /> },
      { path: ROUTES.TEAM_DETAIL, element: <TeamDetailPage /> },
      { path: ROUTES.COMPETITIONS, element: <CompetitionsPage /> },
      { path: ROUTES.COMPETITION_DETAIL, element: <CompetitionDetailPage /> },
      { path: ROUTES.RESULTS, element: <ResultsPage /> },
      { path: ROUTES.DOCUMENTS, element: <DocumentsPage /> },
      { path: ROUTES.NEWS_ADMIN, element: <NewsAdminPage /> },
      { path: ROUTES.CALENDAR_ADMIN, element: <CalendarAdminPage /> },
      { path: ROUTES.VENUES_ADMIN, element: <VenuesAdminPage /> },
      { path: ROUTES.USERS, element: <UsersPage /> },
      { path: ROUTES.REPORTS, element: <ReportsPage /> },
      { path: ROUTES.AUDIT, element: <AuditPage /> },
    ],
  },
]);

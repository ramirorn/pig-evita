// ===========================================
// Application Router
// ===========================================
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

// Admin pages
import { DashboardPage } from '@/pages/admin/DashboardPage';
import {
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
} from '@/pages/admin/index';


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

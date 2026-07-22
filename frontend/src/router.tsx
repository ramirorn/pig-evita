// ===========================================
// Application Router
// ===========================================
import { createBrowserRouter } from 'react-router';
import { ROUTES } from '@/lib/constants';

// Layouts
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';

// Public pages
import { HomePage } from '@/pages/public/HomePage';
import { InscriptionPage } from '@/pages/public/InscriptionPage';
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

  // ============ INSCRIPTION (standalone, no layout) ============
  { path: ROUTES.INSCRIPTION, element: <InscriptionPage /> },

  // ============ AUTH ============
  { path: ROUTES.LOGIN, element: <LoginPage /> },

  // ============ ADMIN ROUTES (Protected) ============
  {
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: ROUTES.ADMIN, element: <DashboardPage /> },
      { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
      { path: ROUTES.PARTICIPANTS, element: <ParticipantsPage /> },
      { path: ROUTES.PARTICIPANT_DETAIL, element: <ParticipantDetailPage /> },
      { path: ROUTES.INSCRIPTIONS, element: <InscriptionsPage /> },
      { path: ROUTES.INSCRIPTION_DETAIL, element: <InscriptionDetailPage /> },
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

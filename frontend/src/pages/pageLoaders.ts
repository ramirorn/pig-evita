// ===========================================
// pageLoaders — el `import()` de cada página de ruta, en un solo lugar
// ===========================================
//
// Lo usan `lazyPages.ts` (el `lazy()` del router) y `lib/routePrefetch.ts`
// (la precarga al apuntar un link). Antes cada uno repetía las rutas de los
// archivos y podían desincronizarse en silencio: un prefetch a un archivo
// movido no falla, sólo deja de precargar. Al ser el mismo `import()`, Vite
// genera un único chunk por página.
//
// Va separado de `lazyPages.ts` porque ese archivo sólo exporta componentes
// (Fast Refresh); éste exporta funciones.

export const PAGE_LOADERS = {
  LoginPage: () => import('@/pages/auth/LoginPage'),
  InscriptionInfoPage: () => import('@/pages/public/InscriptionInfoPage'),
  DisciplinesPage: () => import('@/pages/public/DisciplinesPage'),
  DisciplineDetailPage: () => import('@/pages/public/DisciplineDetailPage'),
  NewsPage: () => import('@/pages/public/NewsPage'),
  NewsDetailPage: () => import('@/pages/public/NewsDetailPage'),
  CalendarPage: () => import('@/pages/public/CalendarPage'),
  VenuesPage: () => import('@/pages/public/VenuesPage'),
  RankingsPage: () => import('@/pages/public/RankingsPage'),
  CompetitionPublicPage: () => import('@/pages/public/CompetitionPublicPage'),
  ImpactMapPage: () => import('@/pages/public/ImpactMapPage'),
  SurveyLandingPage: () => import('@/pages/public/survey/SurveyLandingPage'),
  SurveyFormPage: () => import('@/pages/public/survey/form/SurveyFormPage'),
  AdminLayout: () => import('@/components/layout/AdminLayout'),
  DashboardPage: () => import('@/pages/admin/DashboardPage'),
  MetricsPage: () => import('@/pages/admin/MetricsPage'),
  MetricsPresentationPage: () => import('@/pages/admin/MetricsPresentationPage'),
  ImpactMapAdminPage: () => import('@/pages/admin/ImpactMapAdminPage'),
  ParticipantsPage: () => import('@/pages/admin/ParticipantsPage'),
  ParticipantDetailPage: () => import('@/pages/admin/ParticipantDetailPage'),
  InscriptionsPage: () => import('@/pages/admin/InscriptionsPage'),
  InscriptionDetailPage: () => import('@/pages/admin/InscriptionDetailPage'),
  DelegateInscriptionPage: () => import('@/pages/admin/DelegateInscriptionPage'),
  DisciplinesAdminPage: () => import('@/pages/admin/DisciplinesAdminPage'),
  CategoriesAdminPage: () => import('@/pages/admin/CategoriesAdminPage'),
  TeamsAdminPage: () => import('@/pages/admin/TeamsAdminPage'),
  TeamDetailPage: () => import('@/pages/admin/TeamDetailPage'),
  CompetitionsPage: () => import('@/pages/admin/CompetitionsPage'),
  CompetitionDetailPage: () => import('@/pages/admin/CompetitionDetailPage'),
  ResultsPage: () => import('@/pages/admin/ResultsPage'),
  DocumentsPage: () => import('@/pages/admin/DocumentsPage'),
  NewsAdminPage: () => import('@/pages/admin/NewsAdminPage'),
  CalendarAdminPage: () => import('@/pages/admin/CalendarAdminPage'),
  VenuesAdminPage: () => import('@/pages/admin/VenuesAdminPage'),
  SurveyAdminPage: () => import('@/pages/admin/SurveyAdminPage'),
  SurveyCampaignPage: () => import('@/pages/admin/SurveyCampaignPage'),
  UsersPage: () => import('@/pages/admin/UsersPage'),
  ReportsPage: () => import('@/pages/admin/ReportsPage'),
  AuditPage: () => import('@/pages/admin/AuditPage'),
} as const;

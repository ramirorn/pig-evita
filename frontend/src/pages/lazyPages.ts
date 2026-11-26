// ===========================================
// lazyPages — todas las páginas de rutas, cargadas bajo demanda
// ===========================================
import { lazy } from 'react';
import { PAGE_LOADERS } from './pageLoaders';

/**
 * Cada página del router se declara acá con su propio `lazy()`, y cada `lazy()`
 * produce un chunk que sólo se descarga al entrar a esa ruta.
 *
 * **Dos reglas que hay que respetar al agregar una página:**
 *
 * 1. Se importa desde **su archivo** (en `pageLoaders.ts`), nunca desde un
 *    barrel. Un `import('@/pages/public')` arrastra las nueve
 *    páginas públicas al mismo chunk y anula el split entero: es el error que
 *    tenía el router antes de R28, donde un ciudadano que entraba a ver el
 *    calendario se bajaba también las noticias, las sedes, los rankings y el
 *    login. Los barrels público y admin se borraron para que no haya nada que
 *    importar por accidente.
 * 2. Va en este archivo y no en `router.tsx`. Es una separación de archivo, no
 *    de estilo: `router.tsx` exporta `router`, que no es un componente, y con
 *    los `lazy()` adentro cada uno disparaba un warning de Fast Refresh
 *    (`react(only-export-components)`) — veinte warnings de ruido que tapaban
 *    los reales. Acá **todos** los exports son componentes y el archivo queda
 *    limpio.
 *
 * `HomePage` es la excepción deliberada: no está acá, `router.tsx` la importa
 * de forma estática. Ver el comentario del import allá.
 */

// ============ AUTH ============
export const LoginPage = lazy(() =>
  PAGE_LOADERS.LoginPage().then((m) => ({ default: m.LoginPage })),
);

// ============ PÁGINAS PÚBLICAS ============
export const InscriptionInfoPage = lazy(() =>
  PAGE_LOADERS.InscriptionInfoPage().then((m) => ({ default: m.InscriptionInfoPage })),
);
export const DisciplinesPage = lazy(() =>
  PAGE_LOADERS.DisciplinesPage().then((m) => ({ default: m.DisciplinesPage })),
);
export const DisciplineDetailPage = lazy(() =>
  PAGE_LOADERS.DisciplineDetailPage().then((m) => ({ default: m.DisciplineDetailPage })),
);
export const NewsPage = lazy(() =>
  PAGE_LOADERS.NewsPage().then((m) => ({ default: m.NewsPage })),
);
export const NewsDetailPage = lazy(() =>
  PAGE_LOADERS.NewsDetailPage().then((m) => ({ default: m.NewsDetailPage })),
);
export const CalendarPage = lazy(() =>
  PAGE_LOADERS.CalendarPage().then((m) => ({ default: m.CalendarPage })),
);
export const VenuesPage = lazy(() =>
  PAGE_LOADERS.VenuesPage().then((m) => ({ default: m.VenuesPage })),
);
export const RankingsPage = lazy(() =>
  PAGE_LOADERS.RankingsPage().then((m) => ({ default: m.RankingsPage })),
);
export const CompetitionPublicPage = lazy(() =>
  PAGE_LOADERS.CompetitionPublicPage().then((m) => ({ default: m.CompetitionPublicPage })),
);
export const ImpactMapPage = lazy(() =>
  PAGE_LOADERS.ImpactMapPage().then((m) => ({ default: m.ImpactMapPage })),
);

/**
 * Encuesta (S20). Son dos chunks separados a propósito: la landing es
 * informativa y la lee mucha más gente de la que después contesta, así que el
 * cuestionario —con su wizard, su borrador y los catálogos que consulta— no
 * tiene por qué viajar con ella.
 */
export const SurveyLandingPage = lazy(() =>
  PAGE_LOADERS.SurveyLandingPage().then((m) => ({ default: m.SurveyLandingPage })),
);
export const SurveyFormPage = lazy(() =>
  PAGE_LOADERS.SurveyFormPage().then((m) => ({ default: m.SurveyFormPage })),
);

// ============ ADMIN ============
/**
 * El layout del panel también es lazy (R28): con el import estático, el shell
 * completo del admin —sidebar, header, menú de usuario, "Cerrar sesión"—
 * viajaba en el chunk de entrada y se lo bajaba también el ciudadano que sólo
 * entra a ver el calendario y nunca va a ver un panel.
 */
export const AdminLayout = lazy(() =>
  PAGE_LOADERS.AdminLayout().then((m) => ({ default: m.AdminLayout })),
);

// ============ PÁGINAS ADMIN ============
export const DashboardPage = lazy(() =>
  PAGE_LOADERS.DashboardPage().then((m) => ({ default: m.DashboardPage })),
);
export const MetricsPage = lazy(() =>
  PAGE_LOADERS.MetricsPage().then((m) => ({ default: m.MetricsPage })),
);
export const MetricsPresentationPage = lazy(() =>
  PAGE_LOADERS.MetricsPresentationPage().then((m) => ({ default: m.MetricsPresentationPage })),
);
export const ImpactMapAdminPage = lazy(() =>
  PAGE_LOADERS.ImpactMapAdminPage().then((m) => ({ default: m.ImpactMapAdminPage })),
);
export const ParticipantsPage = lazy(() =>
  PAGE_LOADERS.ParticipantsPage().then((m) => ({ default: m.ParticipantsPage })),
);
export const ParticipantDetailPage = lazy(() =>
  PAGE_LOADERS.ParticipantDetailPage().then((m) => ({ default: m.ParticipantDetailPage })),
);
export const InscriptionsPage = lazy(() =>
  PAGE_LOADERS.InscriptionsPage().then((m) => ({ default: m.InscriptionsPage })),
);
export const InscriptionDetailPage = lazy(() =>
  PAGE_LOADERS.InscriptionDetailPage().then((m) => ({ default: m.InscriptionDetailPage })),
);
export const DelegateInscriptionPage = lazy(() =>
  PAGE_LOADERS.DelegateInscriptionPage().then((m) => ({ default: m.DelegateInscriptionPage })),
);
export const DisciplinesAdminPage = lazy(() =>
  PAGE_LOADERS.DisciplinesAdminPage().then((m) => ({ default: m.DisciplinesAdminPage })),
);
export const CategoriesAdminPage = lazy(() =>
  PAGE_LOADERS.CategoriesAdminPage().then((m) => ({ default: m.CategoriesAdminPage })),
);
export const TeamsAdminPage = lazy(() =>
  PAGE_LOADERS.TeamsAdminPage().then((m) => ({ default: m.TeamsAdminPage })),
);
export const TeamDetailPage = lazy(() =>
  PAGE_LOADERS.TeamDetailPage().then((m) => ({ default: m.TeamDetailPage })),
);
export const CompetitionsPage = lazy(() =>
  PAGE_LOADERS.CompetitionsPage().then((m) => ({ default: m.CompetitionsPage })),
);
export const CompetitionDetailPage = lazy(() =>
  PAGE_LOADERS.CompetitionDetailPage().then((m) => ({ default: m.CompetitionDetailPage })),
);
export const ResultsPage = lazy(() =>
  PAGE_LOADERS.ResultsPage().then((m) => ({ default: m.ResultsPage })),
);
export const DocumentsPage = lazy(() =>
  PAGE_LOADERS.DocumentsPage().then((m) => ({ default: m.DocumentsPage })),
);
export const NewsAdminPage = lazy(() =>
  PAGE_LOADERS.NewsAdminPage().then((m) => ({ default: m.NewsAdminPage })),
);
export const CalendarAdminPage = lazy(() =>
  PAGE_LOADERS.CalendarAdminPage().then((m) => ({ default: m.CalendarAdminPage })),
);
export const VenuesAdminPage = lazy(() =>
  PAGE_LOADERS.VenuesAdminPage().then((m) => ({ default: m.VenuesAdminPage })),
);
/**
 * Encuesta (S20), también en dos chunks: el listado de campañas se abre seguido
 * y es liviano; el editor arrastra el ABM del cuestionario **y** el tablero de
 * métricas, que es lo pesado y sólo hace falta cuando se entra a una campaña.
 */
export const SurveyAdminPage = lazy(() =>
  PAGE_LOADERS.SurveyAdminPage().then((m) => ({ default: m.SurveyAdminPage })),
);
export const SurveyCampaignPage = lazy(() =>
  PAGE_LOADERS.SurveyCampaignPage().then((m) => ({ default: m.SurveyCampaignPage })),
);
export const UsersPage = lazy(() =>
  PAGE_LOADERS.UsersPage().then((m) => ({ default: m.UsersPage })),
);
export const ReportsPage = lazy(() =>
  PAGE_LOADERS.ReportsPage().then((m) => ({ default: m.ReportsPage })),
);
export const AuditPage = lazy(() =>
  PAGE_LOADERS.AuditPage().then((m) => ({ default: m.AuditPage })),
);

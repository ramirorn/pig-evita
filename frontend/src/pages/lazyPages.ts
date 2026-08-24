// ===========================================
// lazyPages — todas las páginas de rutas, cargadas bajo demanda
// ===========================================
import { lazy } from 'react';

/**
 * Cada página del router se declara acá con su propio `lazy()`, y cada `lazy()`
 * produce un chunk que sólo se descarga al entrar a esa ruta.
 *
 * **Dos reglas que hay que respetar al agregar una página:**
 *
 * 1. Se importa desde **su archivo**, nunca desde el barrel (`@/pages/admin` o
 *    `@/pages/public`). Un `import('@/pages/public')` arrastra las nueve
 *    páginas públicas al mismo chunk y anula el split entero: es el error que
 *    tenía el router antes de R28, donde un ciudadano que entraba a ver el
 *    calendario se bajaba también las noticias, las sedes, los rankings y el
 *    login. El barrel público directamente se borró para que no haya nada que
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
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);

// ============ PÁGINAS PÚBLICAS ============
export const InscriptionInfoPage = lazy(() =>
  import('@/pages/public/InscriptionInfoPage').then((m) => ({ default: m.InscriptionInfoPage })),
);
export const DisciplinesPage = lazy(() =>
  import('@/pages/public/DisciplinesPage').then((m) => ({ default: m.DisciplinesPage })),
);
export const DisciplineDetailPage = lazy(() =>
  import('@/pages/public/DisciplineDetailPage').then((m) => ({ default: m.DisciplineDetailPage })),
);
export const NewsPage = lazy(() =>
  import('@/pages/public/NewsPage').then((m) => ({ default: m.NewsPage })),
);
export const NewsDetailPage = lazy(() =>
  import('@/pages/public/NewsDetailPage').then((m) => ({ default: m.NewsDetailPage })),
);
export const CalendarPage = lazy(() =>
  import('@/pages/public/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
export const VenuesPage = lazy(() =>
  import('@/pages/public/VenuesPage').then((m) => ({ default: m.VenuesPage })),
);
export const RankingsPage = lazy(() =>
  import('@/pages/public/RankingsPage').then((m) => ({ default: m.RankingsPage })),
);
export const CompetitionPublicPage = lazy(() =>
  import('@/pages/public/CompetitionPublicPage').then((m) => ({ default: m.CompetitionPublicPage })),
);

// ============ ADMIN ============
/**
 * El layout del panel también es lazy (R28): con el import estático, el shell
 * completo del admin —sidebar, header, menú de usuario, "Cerrar sesión"—
 * viajaba en el chunk de entrada y se lo bajaba también el ciudadano que sólo
 * entra a ver el calendario y nunca va a ver un panel.
 */
export const AdminLayout = lazy(() =>
  import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);

// ============ PÁGINAS ADMIN ============
export const DashboardPage = lazy(() =>
  import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
export const ParticipantsPage = lazy(() =>
  import('@/pages/admin/ParticipantsPage').then((m) => ({ default: m.ParticipantsPage })),
);
export const ParticipantDetailPage = lazy(() =>
  import('@/pages/admin/ParticipantDetailPage').then((m) => ({ default: m.ParticipantDetailPage })),
);
export const InscriptionsPage = lazy(() =>
  import('@/pages/admin/InscriptionsPage').then((m) => ({ default: m.InscriptionsPage })),
);
export const InscriptionDetailPage = lazy(() =>
  import('@/pages/admin/InscriptionDetailPage').then((m) => ({ default: m.InscriptionDetailPage })),
);
export const DelegateInscriptionPage = lazy(() =>
  import('@/pages/admin/DelegateInscriptionPage').then((m) => ({ default: m.DelegateInscriptionPage })),
);
export const DisciplinesAdminPage = lazy(() =>
  import('@/pages/admin/DisciplinesAdminPage').then((m) => ({ default: m.DisciplinesAdminPage })),
);
export const CategoriesAdminPage = lazy(() =>
  import('@/pages/admin/CategoriesAdminPage').then((m) => ({ default: m.CategoriesAdminPage })),
);
export const TeamsAdminPage = lazy(() =>
  import('@/pages/admin/TeamsAdminPage').then((m) => ({ default: m.TeamsAdminPage })),
);
export const TeamDetailPage = lazy(() =>
  import('@/pages/admin/TeamDetailPage').then((m) => ({ default: m.TeamDetailPage })),
);
export const CompetitionsPage = lazy(() =>
  import('@/pages/admin/CompetitionsPage').then((m) => ({ default: m.CompetitionsPage })),
);
export const CompetitionDetailPage = lazy(() =>
  import('@/pages/admin/CompetitionDetailPage').then((m) => ({ default: m.CompetitionDetailPage })),
);
export const ResultsPage = lazy(() =>
  import('@/pages/admin/ResultsPage').then((m) => ({ default: m.ResultsPage })),
);
export const DocumentsPage = lazy(() =>
  import('@/pages/admin/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
export const NewsAdminPage = lazy(() =>
  import('@/pages/admin/NewsAdminPage').then((m) => ({ default: m.NewsAdminPage })),
);
export const CalendarAdminPage = lazy(() =>
  import('@/pages/admin/CalendarAdminPage').then((m) => ({ default: m.CalendarAdminPage })),
);
export const VenuesAdminPage = lazy(() =>
  import('@/pages/admin/VenuesAdminPage').then((m) => ({ default: m.VenuesAdminPage })),
);
export const UsersPage = lazy(() =>
  import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
export const ReportsPage = lazy(() =>
  import('@/pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
export const AuditPage = lazy(() =>
  import('@/pages/admin/AuditPage').then((m) => ({ default: m.AuditPage })),
);

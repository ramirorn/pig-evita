// ===========================================
// Admin Pages — Barrel Exports
// ===========================================
//
// ⚠️ NO importar este barrel desde `router.tsx`. Las rutas admin se cargan con
// `React.lazy()` archivo por archivo (hallazgo Q6): traer el barrel arrastraría
// las 20 páginas al mismo chunk y anularía el code splitting, devolviendo al
// visitante público los ~500 KB de JS admin que hoy no descarga.
export { DisciplinesAdminPage } from './DisciplinesAdminPage';
export { CategoriesAdminPage } from './CategoriesAdminPage';
export { TeamsAdminPage } from './TeamsAdminPage';
export { TeamDetailPage } from './TeamDetailPage';
export { DocumentsPage } from './DocumentsPage';
export { ParticipantsPage } from './ParticipantsPage';
export { ParticipantDetailPage } from './ParticipantDetailPage';
export { InscriptionsPage } from './InscriptionsPage';
export { InscriptionDetailPage } from './InscriptionDetailPage';
export { DelegateInscriptionPage } from './DelegateInscriptionPage';
export { CompetitionsPage } from './CompetitionsPage';
export { CompetitionDetailPage } from './CompetitionDetailPage';
export { ResultsPage } from './ResultsPage';

export { NewsAdminPage } from './NewsAdminPage';
export { CalendarAdminPage } from './CalendarAdminPage';
export { VenuesAdminPage } from './VenuesAdminPage';

export { ReportsPage } from './ReportsPage';
export { UsersPage } from './UsersPage';
export { AuditPage } from './AuditPage';

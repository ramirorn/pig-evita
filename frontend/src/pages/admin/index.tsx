// ===========================================
// Admin Placeholder Pages
// These will be fully implemented in Sprints 2-5
// ===========================================
import {
  Users,
  ClipboardList,
  Swords,
  Medal,
} from 'lucide-react';

export { DisciplinesAdminPage } from './DisciplinesAdminPage';
export { CategoriesAdminPage } from './CategoriesAdminPage';
export { TeamsAdminPage } from './TeamsAdminPage';
export { TeamDetailPage } from './TeamDetailPage';
export { DocumentsPage } from './DocumentsPage';
export * from './ParticipantsPage';
export * from './ParticipantDetailPage';
export * from './InscriptionsPage';
export * from './InscriptionDetailPage';
export * from './CompetitionsPage';
export * from './CompetitionDetailPage';
export * from './ResultsPage';

function AdminPlaceholder({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">{title}</h1>
          <p className="text-sm text-primary-500">{description}</p>
        </div>
      </div>
      <div className="card p-8 text-center">
        <p className="text-primary-500 text-sm">
          Este módulo se implementará en las próximas fases de desarrollo.
        </p>
      </div>
    </div>
  );
}

export function ParticipantsPage() {
  return <AdminPlaceholder icon={<Users className="w-5 h-5 text-white" />} title="Participantes" description="Gestión de participantes registrados" />;
}

export function ParticipantDetailPage() {
  return <AdminPlaceholder icon={<Users className="w-5 h-5 text-white" />} title="Detalle de Participante" description="Información completa del participante" />;
}

export function InscriptionsPage() {
  return <AdminPlaceholder icon={<ClipboardList className="w-5 h-5 text-white" />} title="Inscripciones" description="Revisión y gestión de inscripciones" />;
}

export function InscriptionDetailPage() {
  return <AdminPlaceholder icon={<ClipboardList className="w-5 h-5 text-white" />} title="Detalle de Inscripción" description="Información completa de la inscripción" />;
}

export function CompetitionsPage() {
  return <AdminPlaceholder icon={<Swords className="w-5 h-5 text-white" />} title="Competencias" description="Gestión de competencias y fixtures" />;
}

export function CompetitionDetailPage() {
  return <AdminPlaceholder icon={<Swords className="w-5 h-5 text-white" />} title="Detalle de Competencia" description="Fixture, partidos y resultados" />;
}

export function ResultsPage() {
  return <AdminPlaceholder icon={<Medal className="w-5 h-5 text-white" />} title="Resultados" description="Carga de resultados y rankings" />;
}

export * from './NewsAdminPage';
export * from './CalendarAdminPage';
export * from './VenuesAdminPage';

export * from './ReportsPage';
export * from './UsersPage';
export * from './AuditPage';

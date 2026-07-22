// ===========================================
// Admin Dashboard Page
// ===========================================
import { LayoutDashboard, Users, ClipboardList, UsersRound, Trophy, Activity, Loader2 } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { useInscriptions } from '@/hooks/useInscriptions';
import { useTeams } from '@/hooks/useTeams';
import { useCompetitions } from '@/hooks/useCompetitions';
import { InscriptionStatus } from '@/types';

export function DashboardPage() {
  const { data: participantsData, isLoading: isLoadingP } = useParticipants({ limit: 1 });
  const { data: inscriptionsData, isLoading: isLoadingI } = useInscriptions({ limit: 1 });
  const { data: pendingInscriptions, isLoading: isLoadingPI } = useInscriptions({ status: InscriptionStatus.PENDIENTE, limit: 1 });
  const { data: teamsData, isLoading: isLoadingT } = useTeams({ limit: 1 });
  const { data: competitionsData, isLoading: isLoadingC } = useCompetitions({ limit: 1 });

  const isLoading = isLoadingP || isLoadingI || isLoadingPI || isLoadingT || isLoadingC;

  const stats = [
    { label: 'Participantes', value: participantsData?.meta.total || 0, icon: <Users className="w-6 h-6" />, color: 'from-blue-500 to-blue-600' },
    { label: 'Inscripciones', value: inscriptionsData?.meta.total || 0, icon: <ClipboardList className="w-6 h-6" />, color: 'from-purple-500 to-purple-600' },
    { label: 'Equipos', value: teamsData?.meta.total || 0, icon: <UsersRound className="w-6 h-6" />, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Competencias', value: competitionsData?.meta.total || 0, icon: <Trophy className="w-6 h-6" />, color: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">Dashboard</h1>
          <p className="text-sm text-primary-500">Resumen general del sistema</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`stat-card animate-fade-in stagger-${idx + 1}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm`}>
                    {stat.icon}
                  </div>
                </div>
                <p className="text-3xl font-black text-primary-900">{stat.value}</p>
                <p className="text-sm font-medium text-primary-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-6 border-t-4 border-t-orange-500">
              <h3 className="font-bold text-primary-900 mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Acción Requerida
              </h3>
              <p className="text-primary-600 mb-4 text-sm">
                Hay inscripciones pendientes de revisión que requieren atención administrativa.
              </p>
              <div className="text-3xl font-black text-orange-600 mb-2">
                {pendingInscriptions?.meta.total || 0}
              </div>
              <p className="text-sm font-medium text-primary-500">
                Inscripciones Pendientes
              </p>
            </div>
            
            <div className="card p-6 border-t-4 border-t-primary-500">
               <h3 className="font-bold text-primary-900 mb-2">Atajos Rápidos</h3>
               <div className="grid grid-cols-2 gap-4 mt-4">
                  <a href="/admin/inscripciones" className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                    Revisar Inscripciones
                  </a>
                  <a href="/admin/competencias" className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                    Generar Fixtures
                  </a>
                  <a href="/admin/resultados" className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                    Cargar Resultados
                  </a>
                  <a href="/admin/reportes" className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                    Descargar Reportes
                  </a>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

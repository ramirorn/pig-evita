// ===========================================
// Admin Dashboard Page
// ===========================================
import { Link } from 'react-router';
import {
  LayoutDashboard, Users, ClipboardList, UsersRound, Trophy,
  Activity, Loader2, TrendingUp, ArrowRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useParticipants } from '@/hooks/useParticipants';
import { useInscriptions } from '@/hooks/useInscriptions';
import { useTeams } from '@/hooks/useTeams';
import { useCompetitions } from '@/hooks/useCompetitions';
import { InscriptionStatus } from '@/types';
import { ROUTES, INSCRIPTION_STATUS_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatRelativeTime } from '@/lib/utils';

const DONUT_COLORS = {
  [InscriptionStatus.PENDIENTE]: '#E8AA34',    // accent-500
  [InscriptionStatus.REVISADA]: '#1b5ea9',     // primary-500
  [InscriptionStatus.APROBADA]: '#2D723B',     // secondary-500
  [InscriptionStatus.RECHAZADA]: '#d32f2f',    // destructive-500
};

export function DashboardPage() {
  const { data: participantsData, isLoading: isLoadingP } = useParticipants({ limit: 1 });
  const { data: inscriptionsData, isLoading: isLoadingI } = useInscriptions({ limit: 5 });
  const { data: pendingInscriptions, isLoading: isLoadingPI } = useInscriptions({ status: InscriptionStatus.PENDIENTE, limit: 1 });
  const { data: reviewedInscriptions } = useInscriptions({ status: InscriptionStatus.REVISADA, limit: 1 });
  const { data: approvedInscriptions } = useInscriptions({ status: InscriptionStatus.APROBADA, limit: 1 });
  const { data: rejectedInscriptions } = useInscriptions({ status: InscriptionStatus.RECHAZADA, limit: 1 });
  const { data: teamsData, isLoading: isLoadingT } = useTeams({ limit: 1 });
  const { data: competitionsData, isLoading: isLoadingC } = useCompetitions({ limit: 1 });

  const isLoading = isLoadingP || isLoadingI || isLoadingPI || isLoadingT || isLoadingC;

  const stats = [
    { label: 'Participantes', value: participantsData?.meta.total || 0, icon: <Users className="w-6 h-6" />, color: 'from-primary-500 to-primary-700', link: ROUTES.PARTICIPANTS },
    { label: 'Inscripciones', value: inscriptionsData?.meta.total || 0, icon: <ClipboardList className="w-6 h-6" />, color: 'from-celeste-500 to-celeste-700', link: ROUTES.INSCRIPTIONS },
    { label: 'Equipos', value: teamsData?.meta.total || 0, icon: <UsersRound className="w-6 h-6" />, color: 'from-secondary-500 to-secondary-600', link: ROUTES.TEAMS },
    { label: 'Competencias', value: competitionsData?.meta.total || 0, icon: <Trophy className="w-6 h-6" />, color: 'from-accent-500 to-accent-600', link: ROUTES.COMPETITIONS },
  ];

  // Build donut data
  const donutData = [
    { name: INSCRIPTION_STATUS_LABELS[InscriptionStatus.PENDIENTE], value: pendingInscriptions?.meta.total || 0, key: InscriptionStatus.PENDIENTE },
    { name: INSCRIPTION_STATUS_LABELS[InscriptionStatus.REVISADA], value: reviewedInscriptions?.meta.total || 0, key: InscriptionStatus.REVISADA },
    { name: INSCRIPTION_STATUS_LABELS[InscriptionStatus.APROBADA], value: approvedInscriptions?.meta.total || 0, key: InscriptionStatus.APROBADA },
    { name: INSCRIPTION_STATUS_LABELS[InscriptionStatus.RECHAZADA], value: rejectedInscriptions?.meta.total || 0, key: InscriptionStatus.RECHAZADA },
  ].filter((d) => d.value > 0);

  const recentInscriptions = inscriptionsData?.data.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen general del sistema"
        icon={<LayoutDashboard className="w-5 h-5 text-white" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <Link
                key={stat.label}
                to={stat.link}
                className={`stat-card group hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in cursor-pointer`}
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm group-hover:shadow-md transition-shadow`}>
                    {stat.icon}
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary-300 group-hover:text-primary-500 transition-colors" />
                </div>
                <p className="text-3xl font-black text-primary-900 animate-count-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-primary-500">{stat.label}</p>
              </Link>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Donut chart — Inscriptions by status */}
            <div className="card p-6">
              <h3 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" />
                Inscripciones por Estado
              </h3>
              {donutData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="w-40 h-40 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {donutData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={DONUT_COLORS[entry.key as InscriptionStatus]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${value}`, `${name}`]}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '13px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {donutData.map((d) => (
                      <div key={d.key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: DONUT_COLORS[d.key as InscriptionStatus] }}
                          />
                          <span className="text-primary-600">{d.name}</span>
                        </div>
                        <span className="font-bold text-primary-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center py-8 text-primary-500 text-sm">
                  No hay inscripciones todavía.
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div className="card p-6">
              <h3 className="font-bold text-primary-900 mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Acción Requerida
              </h3>
              <p className="text-primary-600 mb-4 text-sm">
                Hay inscripciones pendientes de revisión que requieren atención administrativa.
              </p>
              <div className="text-3xl font-black text-orange-600 mb-4">
                {pendingInscriptions?.meta.total || 0}
                <span className="text-sm font-medium text-primary-500 ml-2">Pendientes</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-primary-100">
                <Link to={ROUTES.INSCRIPTIONS} className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                  Revisar Inscripciones
                </Link>
                <Link to={ROUTES.COMPETITIONS} className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                  Generar Fixtures
                </Link>
                <Link to={ROUTES.RESULTS} className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                  Cargar Resultados
                </Link>
                <Link to={ROUTES.REPORTS} className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors">
                  Descargar Reportes
                </Link>
              </div>
            </div>
          </div>

          {/* Recent inscriptions */}
          {recentInscriptions.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between px-6 py-4 border-b border-primary-100">
                <h3 className="font-bold text-primary-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary-500" />
                  Inscripciones Recientes
                </h3>
                <Link
                  to={ROUTES.INSCRIPTIONS}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
                >
                  Ver todas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-primary-50">
                {recentInscriptions.map((insc) => (
                  <Link
                    key={insc.id}
                    to={`/admin/inscripciones/${insc.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-primary-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                        {insc.participant?.firstName?.charAt(0)}{insc.participant?.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary-800">
                          {insc.participant?.lastName}, {insc.participant?.firstName}
                        </p>
                        <p className="text-xs text-primary-500">
                          {insc.category?.name} · {insc.qrCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-primary-400">
                        {formatRelativeTime(insc.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

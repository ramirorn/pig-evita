// ===========================================
// Admin Dashboard Page
// ===========================================
import { Link } from 'react-router';
import {
  LayoutDashboard, Users, ClipboardList, UsersRound, Trophy,
  Activity, Loader2, TrendingUp, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAuth } from '@/store/auth.store';
import { puedeVerRuta, type AdminRoutePath } from '@/lib/adminRoutes';
import { InscriptionStatus } from '@/types';
import { ROUTES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeTime } from '@/lib/utils';
import { InscriptionsStatusCard } from './dashboard/InscriptionsStatusCard';
import { quickActionsParaRol } from './dashboard/quickActions';

export function DashboardPage() {
  // Una sola request para todo el panel (hallazgo Q3): antes eran 8 `useQuery`
  // que sólo se usaban para leer 8 contadores distintos.
  const { data: stats, isLoading, isError } = useDashboardStats();
  const { user } = useAuth();

  // El dashboard lo ven admins y coordinadores, pero sus atajos apuntaban a
  // pantallas con permisos más chicos: un COORDINADOR tenía cuatro botones y
  // tres lo mandaban a "Acceso Denegado" (R08). Se filtran con el mismo mapa que
  // usa el router.
  const puedeIr = (path: AdminRoutePath) => user !== null && puedeVerRuta(user.role, path);

  // A propósito SIN `useMemo` (hallazgo Q18): la única cosa que cambia entre
  // renders de esta página es `stats`, que además sería la única dependencia del
  // memo. O sea que el memo nunca acertaría: recalcularía igual en cada render y
  // encima sumaría la comparación de deps. Además estas 4 tarjetas se pintan
  // como `<Link>` planos, no hay ningún hijo memoizado que se beneficie de una
  // identidad referencial estable.
  const cards = [
    { label: 'Participantes', value: stats?.totalParticipants ?? 0, icon: <Users className="w-6 h-6" />, color: 'from-primary-500 to-primary-700', link: ROUTES.PARTICIPANTS },
    { label: 'Inscripciones', value: stats?.totalInscriptions ?? 0, icon: <ClipboardList className="w-6 h-6" />, color: 'from-celeste-500 to-celeste-700', link: ROUTES.INSCRIPTIONS },
    { label: 'Equipos', value: stats?.totalTeams ?? 0, icon: <UsersRound className="w-6 h-6" />, color: 'from-secondary-500 to-secondary-600', link: ROUTES.TEAMS },
    { label: 'Competencias', value: stats?.totalCompetitions ?? 0, icon: <Trophy className="w-6 h-6" />, color: 'from-accent-500 to-accent-600', link: ROUTES.COMPETITIONS },
  ];

  // Accesos rápidos: sólo los que el rol puede abrir de verdad.
  const quickActions = quickActionsParaRol(user?.role);

  const pendingCount =
    stats?.inscriptionsByStatus.find((row) => row.status === InscriptionStatus.PENDIENTE)?.count ?? 0;

  // Ya vienen ordenadas de la más nueva a la más vieja y con tope de 5.
  const recentInscriptions = stats?.recentInscriptions ?? [];

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
      ) : isError || !stats ? (
        <div className="card">
          <EmptyState
            icon={<AlertTriangle className="w-10 h-10" />}
            title="No pudimos cargar el resumen"
            description="Volvé a intentarlo en unos minutos. Si el problema sigue, avisale al equipo técnico."
          />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((stat, idx) => {
              const contenido = (
                <>
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
                </>
              );

              // El número se muestra igual; lo que se saca es el link cuando el
              // rol no puede abrir esa pantalla, para no ofrecer un camino que
              // termina en "Acceso Denegado".
              return puedeIr(stat.link) ? (
                <Link
                  key={stat.label}
                  to={stat.link}
                  className={`stat-card group hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in cursor-pointer`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  {contenido}
                </Link>
              ) : (
                <div
                  key={stat.label}
                  className="stat-card group animate-fade-in"
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  {contenido}
                </div>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <InscriptionsStatusCard data={stats.inscriptionsByStatus} />

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
                {pendingCount}
                <span className="text-sm font-medium text-primary-500 ml-2">Pendientes</span>
              </div>

              {quickActions.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-primary-100">
                  {quickActions.map((action) => (
                    <Link
                      key={action.link}
                      to={action.link}
                      className="p-3 bg-primary-50 rounded-lg text-primary-700 font-medium text-sm text-center hover:bg-primary-100 transition-colors"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent inscriptions */}
          {/* El listado sólo tiene sentido para quien puede abrir una inscripción. */}
          {puedeIr(ROUTES.INSCRIPTIONS) && recentInscriptions.length > 0 && (
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
                        {insc.participant.firstName.charAt(0)}{insc.participant.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary-800">
                          {insc.participant.lastName}, {insc.participant.firstName}
                        </p>
                        <p className="text-xs text-primary-500">
                          {insc.category.name} · {insc.qrCode}
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

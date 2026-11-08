// ===========================================
// Admin Dashboard Page
// ===========================================
import { Link } from 'react-router';
import {
  LayoutDashboard, Users, ClipboardList, UsersRound, Trophy,
  Activity, Loader2, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useAuth } from '@/store/auth.store';
import { puedeVerRuta, type AdminRoutePath } from '@/lib/adminRoutes';
import { InscriptionStatus } from '@/types';
import { ROUTES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { tiempoRelativo } from '@/lib/utils';
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
    { label: 'Participantes', value: stats?.totalParticipants ?? 0, icon: <Users className="w-5 h-5" />, link: ROUTES.PARTICIPANTS },
    { label: 'Inscripciones', value: stats?.totalInscriptions ?? 0, icon: <ClipboardList className="w-5 h-5" />, link: ROUTES.INSCRIPTIONS },
    { label: 'Equipos', value: stats?.totalTeams ?? 0, icon: <UsersRound className="w-5 h-5" />, link: ROUTES.TEAMS },
    { label: 'Competencias', value: stats?.totalCompetitions ?? 0, icon: <Trophy className="w-5 h-5" />, link: ROUTES.COMPETITIONS },
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
          {/* Acción requerida: lo primero que se ve, antes de los contadores. */}
          <section className="card border-accent-300 bg-accent-50 p-5 md:p-6" aria-labelledby="accion-requerida">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <p className="type-h1 shrink-0 tabular-nums text-accent-800" aria-hidden="true">
                  {pendingCount}
                </p>
                <div>
                  <h2 id="accion-requerida" className="type-h3 text-primary-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-accent-700" aria-hidden="true" />
                    Acción Requerida
                  </h2>
                  <p className="mt-1 text-sm text-primary-700">
                    Hay inscripciones pendientes de revisión que requieren atención administrativa.
                  </p>
                  <p className="mt-1 text-sm font-medium text-primary-800">
                    <span className="tabular-nums">{pendingCount}</span> Pendientes
                  </p>
                </div>
              </div>
              {puedeIr(ROUTES.INSCRIPTIONS) && (
                <Button asChild size="lg" className="shrink-0">
                  <Link to={ROUTES.INSCRIPTIONS}>
                    Revisar Inscripciones
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>

            {quickActions.filter((action) => action.link !== ROUTES.INSCRIPTIONS).length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-accent-200 pt-4 sm:grid-cols-3">
                {quickActions
                  .filter((action) => action.link !== ROUTES.INSCRIPTIONS)
                  .map((action) => (
                    <Link
                      key={action.link}
                      to={action.link}
                      className="flex min-h-11 items-center justify-center rounded-lg border border-primary-200 bg-white px-3 text-sm font-medium text-primary-800 transition-colors duration-120 hover:bg-primary-50 active:bg-primary-100"
                    >
                      {action.label}
                    </Link>
                  ))}
              </div>
            )}
          </section>

          {/* Contadores: contexto, no acción. Más chicos que la tarjeta de arriba. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((stat) => {
              const contenido = (
                <>
                  <div className="mb-2 flex items-center gap-2 text-primary-600">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      {stat.icon}
                    </span>
                    <p className="text-sm font-medium text-primary-600">{stat.label}</p>
                  </div>
                  <p className="type-h2 tabular-nums text-primary-900">{stat.value}</p>
                </>
              );

              // El número se muestra igual; lo que se saca es el link cuando el
              // rol no puede abrir esa pantalla, para no ofrecer un camino que
              // termina en "Acceso Denegado".
              return puedeIr(stat.link) ? (
                <Link
                  key={stat.label}
                  to={stat.link}
                  className="card card-interactive block p-4 hover:border-primary-300 active:bg-primary-50"
                >
                  {contenido}
                </Link>
              ) : (
                <div key={stat.label} className="card p-4">
                  {contenido}
                </div>
              );
            })}
          </div>

          <InscriptionsStatusCard data={stats.inscriptionsByStatus} />

          {/* Recent inscriptions */}
          {/* El listado sólo tiene sentido para quien puede abrir una inscripción. */}
          {puedeIr(ROUTES.INSCRIPTIONS) && recentInscriptions.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between px-6 py-4 border-b border-primary-100">
                <h2 className="type-h3 text-primary-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary-500" />
                  Inscripciones Recientes
                </h2>
                <Link
                  to={ROUTES.INSCRIPTIONS}
                  className="text-sm font-semibold text-primary-700 hover:text-primary-900 hover:underline flex min-h-11 items-center gap-1 transition-colors duration-120"
                >
                  Ver todas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="divide-y divide-primary-50">
                {recentInscriptions.map((insc) => (
                  <Link
                    key={insc.id}
                    to={`/admin/inscripciones/${insc.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-primary-50 active:bg-primary-100 transition-colors duration-120"
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
                      <span className="text-xs text-primary-500">
                        {tiempoRelativo(insc.createdAt)}
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

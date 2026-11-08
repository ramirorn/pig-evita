import { Link, useParams } from 'react-router';
import { Trophy, ArrowLeft, Calendar, CalendarDays, LayoutGrid, Medal, Activity } from 'lucide-react';
import { useCompetition } from '@/hooks/useCompetitions';
import { useRankings } from '@/hooks/useResults';
import { rankingRowKey } from './competition/rankingRowKey';
import { PublicFixture } from './competition/PublicFixture';
import { FORMAT_LABELS, ROUTES, STAGE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { CompetitionFormat } from '@/types';
import { cn } from '@/lib/utils';

/** Esqueleto con la forma de la página: encabezado y dos paneles. */
function CompetitionSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Cargando la competencia…</span>
      <div className="mb-6 h-6 w-40 rounded bg-primary-100 animate-shimmer" />
      <div className="card mb-8 h-44 animate-shimmer bg-primary-100 sm:h-52" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="card h-96 animate-shimmer bg-primary-50" />
        <div className="card h-96 animate-shimmer bg-primary-50" />
      </div>
    </div>
  );
}

const ENLACE_PRIMARIO =
  'inline-flex items-center gap-2 rounded-full bg-primary-800 px-5 py-2.5 text-sm font-bold text-white transition-colors duration-120 hover:bg-primary-900 active:bg-primary-950 pointer-coarse:min-h-11';

export function CompetitionPublicPage() {
  const { id } = useParams<{ id: string }>();

  const { data: competition, isLoading: isLoadingComp } = useCompetition(id || '');
  const { data: rankings, isLoading: isLoadingRankings } = useRankings(id || '');

  if (isLoadingComp) return <CompetitionSkeleton />;

  if (!competition) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="type-h1 mb-3 text-primary-900">No encontramos esta competencia</h1>
        <p className="mb-6 text-primary-700">
          Puede que el enlace esté incompleto o que la competencia ya no esté publicada.
          Buscala en el listado de torneos.
        </p>
        <Link to={ROUTES.RANKINGS} className={ENLACE_PRIMARIO}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Ver todos los torneos
        </Link>
      </div>
    );
  }

  const titulo =
    competition.name?.trim() ||
    [competition.discipline?.name, competition.category?.name].filter(Boolean).join(' - ') ||
    'Competencia';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        to={ROUTES.RANKINGS}
        className="-ml-2 mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary-700 transition-colors duration-120 hover:bg-primary-50 hover:text-primary-900 pointer-coarse:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a Torneos
      </Link>

      <div className="card relative mb-8 overflow-hidden bg-gradient-to-br from-primary-900 to-primary-700 p-5 text-white sm:p-8">
        <div className="absolute -right-20 -top-20 opacity-10" aria-hidden="true">
          <Trophy className="h-96 w-96" />
        </div>
        <div className="relative z-10">
          <Badge variant="outline" className="mb-4 border-white/40 bg-white/15 text-white uppercase">
            Etapa {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
          </Badge>
          <h1 className="type-h1 mb-4 break-words">{titulo}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-medium text-primary-100">
            {competition.discipline?.name && (
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5" aria-hidden="true" /> {competition.discipline.name}
              </span>
            )}
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" aria-hidden="true" /> Formato:{' '}
              {FORMAT_LABELS[competition.format as keyof typeof FORMAT_LABELS] || competition.format}
            </span>
          </div>
        </div>
      </div>

      {/* `min-w-0` en cada columna: sin él, el ítem de la grilla se estira al
          ancho mínimo de la tabla y el `overflow-x-auto` nunca llega a
          scrollear, así que la página entera desbordaba a 375 px (F-40). Dos
          columnas recién desde `lg`: a 768 px la tabla de 7 columnas no entra. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="tabla-titulo" className="card min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-primary-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <Medal className="h-5 w-5 text-primary-700" aria-hidden="true" />
            </div>
            <h2 id="tabla-titulo" className="type-h2 text-primary-900">
              Tabla de Posiciones
            </h2>
          </div>

          {isLoadingRankings ? (
            <div className="space-y-2" role="status" aria-busy="true">
              <span className="sr-only">Cargando la tabla de posiciones…</span>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-12 rounded-lg bg-primary-50 animate-shimmer" />
              ))}
            </div>
          ) : competition.format === CompetitionFormat.ELIMINACION_DIRECTA ? (
            <div className="py-10 text-center text-primary-700">
              <p className="font-semibold text-primary-900">Esta competencia es de eliminación directa.</p>
              <p className="mt-2 text-sm">
                No hay tabla de posiciones: los cruces y los resultados están en el fixture.
              </p>
              <a
                href="#fixture"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary-300 px-5 py-2.5 text-sm font-bold text-primary-800 transition-colors duration-120 hover:bg-primary-50 active:bg-primary-100 pointer-coarse:min-h-11"
              >
                Ir al fixture
              </a>
            </div>
          ) : !rankings || rankings.length === 0 ? (
            <div className="py-10 text-center text-primary-700">
              <p className="font-semibold text-primary-900">
                Todavía no hay resultados cargados para esta competencia.
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm">
                La tabla se arma sola a medida que se cargan los partidos jugados.
              </p>
              <Link to={ROUTES.CALENDAR} className={cn(ENLACE_PRIMARIO, 'mt-4')}>
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Ver cuándo se juega
              </Link>
            </div>
          ) : (
            <>
              <div className="relative overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <caption className="sr-only">Tabla de posiciones de {titulo}</caption>
                  <thead className="bg-primary-50 text-xs text-primary-700 uppercase">
                    <tr>
                      <th scope="col" className="rounded-tl-lg px-2 py-3 sm:px-3">#</th>
                      <th scope="col" className="px-2 py-3 sm:px-3">Equipo / Participante</th>
                      <th scope="col" className="px-1.5 py-3 text-center sm:px-3">PJ</th>
                      <th scope="col" className="px-1.5 py-3 text-center sm:px-3">PG</th>
                      <th scope="col" className="px-1.5 py-3 text-center sm:px-3">E</th>
                      <th scope="col" className="px-1.5 py-3 text-center sm:px-3">PP</th>
                      <th scope="col" className="rounded-tr-lg px-2 py-3 text-center font-bold text-primary-900 sm:px-3">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-100">
                    {rankings.map((entry, idx) => {
                      const puesto = entry.position ?? idx + 1;
                      return (
                        <tr key={rankingRowKey(entry, idx)} className={puesto <= 3 ? 'bg-warning-50/50' : ''}>
                          <td className="px-2 py-3.5 font-bold text-primary-900 sm:px-3">
                            {entry.group ? `${entry.group}${puesto}` : puesto}
                          </td>
                          <td className="px-2 py-3.5 font-medium break-words text-primary-900 sm:px-3">
                            {entry.name}
                          </td>
                          <td className="px-1.5 py-3.5 text-center text-primary-700 sm:px-3">{entry.played}</td>
                          <td className="px-1.5 py-3.5 text-center text-primary-700 sm:px-3">{entry.won}</td>
                          <td className="px-1.5 py-3.5 text-center text-primary-700 sm:px-3">{entry.drawn ?? 0}</td>
                          <td className="px-1.5 py-3.5 text-center text-primary-700 sm:px-3">{entry.lost}</td>
                          <td className="px-2 py-3.5 text-center font-bold text-primary-900 sm:px-3">{entry.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Las abreviaturas con `title` no se leen en el celular: se explican acá. */}
              <p className="mt-3 text-xs text-primary-700">
                PJ jugados · PG ganados · E empatados · PP perdidos · PTS puntos
              </p>
            </>
          )}
        </section>

        <section id="fixture" aria-labelledby="fixture-titulo" className="card min-w-0 scroll-mt-24 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-primary-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
              <Calendar className="h-5 w-5 text-primary-700" aria-hidden="true" />
            </div>
            <h2 id="fixture-titulo" className="type-h2 text-primary-900">
              Fixture y Resultados
            </h2>
          </div>

          <PublicFixture matches={competition.matches ?? []} resultType={competition.discipline?.resultType} />
        </section>
      </div>
    </div>
  );
}

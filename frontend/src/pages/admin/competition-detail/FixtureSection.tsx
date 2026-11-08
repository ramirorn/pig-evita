// ===========================================
// FixtureSection — fixture agrupado por fecha + generación automática
// ===========================================
import { useMemo } from 'react';
import { Calendar, CheckCircle2, LayoutGrid, Loader2 } from 'lucide-react';
import { CompetitionFormat, type Match } from '@/types';
import { Button } from '@/components/ui/button';
import type { ResultType } from '@/types';
import { MatchCard } from './MatchCard';

interface FixtureSectionProps {
  matches: Match[];
  format: string;
  /** Tipo de resultado de la disciplina, para leer bien el marcador. */
  resultType: ResultType | undefined;
  /**
   * Competidores elegibles (equipos, o participantes con inscripción APROBADA
   * en las disciplinas individuales): por debajo de 2 no hay fixture.
   */
  teamCount: number;
  /** "equipos" o "participantes", según el tipo de disciplina (F-29). */
  unidad?: string;
  isGenerating: boolean;
  onGenerate: () => void;
  /** `COMPETITION_MANAGE`: sin él no se ofrece generar el fixture (F-31). */
  puedeGestionar?: boolean;
  /** `RESULT_LOAD`: carga de resultados en cada partido (F-32). */
  puedeCargar?: boolean;
  /** Corrección de partidos FINALIZADOS (`RESULT_CORRECTORS`). */
  puedeCorregir?: boolean;
}

export function FixtureSection({
  matches,
  format,
  resultType,
  teamCount,
  unidad = 'equipos',
  isGenerating,
  onGenerate,
  puedeGestionar = true,
  puedeCargar = false,
  puedeCorregir = false,
}: FixtureSectionProps) {
  const hasMatches = matches.length > 0;

  // Agrupación de partidos por fecha (hallazgo Q20). Es un recorrido O(n) sobre
  // todos los partidos del fixture que antes se rehacía en *cada* render, y la
  // sección se re-renderiza por cosas que no tocan el fixture: el refetch de
  // `useTeams` y cada cambio de `isPending` de la mutación. Con `useMemo` sólo
  // se recalcula cuando cambia el array de partidos que devuelve React Query.
  const matchesByRound = useMemo(() => {
    const grouped = new Map<number, Match[]>();
    for (const match of matches) {
      const bucket = grouped.get(match.round);
      if (bucket) bucket.push(match);
      else grouped.set(match.round, [match]);
    }
    // Se ordena por número de fecha para no depender del orden en que vengan
    // del backend (antes lo garantizaba, sin quererlo, el orden numérico de las
    // claves de un objeto).
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([round, roundMatches]) => ({ round, matches: roundMatches }));
  }, [matches]);

  return (
    <section aria-labelledby="fixture-titulo" className="card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 id="fixture-titulo" className="type-h2 text-primary-900">Fixture y partidos</h2>
        {!hasMatches && puedeGestionar && (
          <Button 
            onClick={onGenerate} 
            disabled={isGenerating || teamCount < 2}
            className="gap-2 w-full sm:w-auto"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Calendar className="w-4 h-4" aria-hidden="true" />
            )}
            {isGenerating ? 'Generando el fixture…' : 'Generar fixture automático'}
          </Button>
        )}
      </div>

      {hasMatches ? (
        <div className="space-y-6">
          {matchesByRound.map(({ round, matches: roundMatches }) => (
            <div key={round}>
              <h3 className="type-h3 text-primary-800 mb-3">Fecha <span className="tabular-nums">{round}</span></h3>
              <div className="grid gap-3 md:grid-cols-2">
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    resultType={resultType}
                    puedeCargar={puedeCargar}
                    puedeCorregir={puedeCorregir}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-success-700 bg-success-50 rounded-lg p-3 border border-success-200" role="status">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">
              Fixture generado: {matches.length} partidos en {matchesByRound.length} fechas
            </span>
          </div>
        </div>
      ) : !puedeGestionar ? (
        <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
          <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-primary-800 font-medium">Todavía no hay fixture</h3>
          <p className="text-sm text-primary-600 mt-1 max-w-md mx-auto">
            Cuando la organización genere los partidos vas a poder cargar sus resultados desde acá.
          </p>
        </div>
      ) : (
        <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
          <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" aria-hidden="true" />
          {format === CompetitionFormat.ELIMINACION_DIRECTA ? (
            <>
              <h3 className="text-primary-800 font-medium">Llaves eliminatorias</h3>
              <p className="text-sm text-primary-600 mt-1 max-w-md mx-auto">
                Tocá "Generar fixture automático" para sortear los cruces eliminatorios entre los {teamCount} {unidad} inscriptos.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-primary-800 font-medium">Liga: todos contra todos</h3>
              <p className="text-sm text-primary-600 mt-1 max-w-md mx-auto">
                {teamCount >= 2 
                  ? `Hay ${teamCount} ${unidad} disponibles. Tocá "Generar fixture automático" para programar todas las fechas.`
                  : `Se necesitan al menos 2 ${unidad} inscriptos para generar el fixture. Cuando los haya, el botón se habilita.`
                }
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

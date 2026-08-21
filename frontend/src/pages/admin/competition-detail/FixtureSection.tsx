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
  /** Equipos elegibles: por debajo de 2 no se puede generar el fixture. */
  teamCount: number;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function FixtureSection({
  matches,
  format,
  resultType,
  teamCount,
  isGenerating,
  onGenerate,
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
    <div className="card p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-primary-900 text-lg">Fixture y Partidos</h3>
        {!hasMatches && (
          <Button 
            onClick={onGenerate} 
            disabled={isGenerating || teamCount < 2}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Generar Fixture Automático
          </Button>
        )}
      </div>

      {hasMatches ? (
        <div className="space-y-6">
          {matchesByRound.map(({ round, matches: roundMatches }) => (
            <div key={round}>
              <h4 className="text-sm font-bold text-primary-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-black">
                  {round}
                </span>
                Fecha {round}
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                {roundMatches.map((match) => (
                  <MatchCard key={match.id} match={match} resultType={resultType} />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3 border border-green-200">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">
              Fixture generado: {matches.length} partidos en {matchesByRound.length} fechas
            </span>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
          <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" />
          {format === CompetitionFormat.ELIMINACION_DIRECTA ? (
            <>
              <h4 className="text-primary-800 font-medium">Llaves Eliminatorias</h4>
              <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
                Presione "Generar Fixture Automático" para sortear los cruces eliminatorios entre los {teamCount} equipos inscriptos.
              </p>
            </>
          ) : (
            <>
              <h4 className="text-primary-800 font-medium">Tabla de Liga — Todos contra todos</h4>
              <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
                {teamCount >= 2 
                  ? `Hay ${teamCount} equipos disponibles. Presione "Generar Fixture Automático" para programar las fechas del Round Robin.`
                  : 'Se necesitan al menos 2 equipos inscriptos para generar el fixture.'
                }
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

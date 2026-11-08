import { useParams, useNavigate } from 'react-router';
import { Trophy, ArrowLeft, Loader2, Calendar, LayoutGrid, Medal, Activity } from 'lucide-react';
import { useCompetition } from '@/hooks/useCompetitions';
import { useRankings } from '@/hooks/useResults';
import { rankingRowKey } from './competition/rankingRowKey';
import { PublicFixture } from './competition/PublicFixture';
import { FORMAT_LABELS, STAGE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompetitionFormat } from '@/types';

export function CompetitionPublicPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: competition, isLoading: isLoadingComp } = useCompetition(id || '');
  const { data: rankings, isLoading: isLoadingRankings } = useRankings(id || '');

  if (isLoadingComp) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-20">
        <h2 className="type-h2 text-primary-800 mb-4">Competencia no encontrada</h2>
        <Button onClick={() => navigate('/rankings')}>Volver a Rankings</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <Button variant="ghost" className="mb-6 -ml-4 pointer-coarse:min-h-11" onClick={() => navigate('/rankings')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Torneos
      </Button>

      <div className="card p-5 sm:p-8 mb-8 bg-gradient-to-br from-primary-900 to-primary-700 text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 opacity-10">
          <Trophy className="w-96 h-96" />
        </div>
        <div className="relative z-10">
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 mb-4 uppercase">
            Etapa {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
          </Badge>
          <h1 className="type-h1 mb-4 break-words">
            {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-primary-100 font-medium">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> {competition.discipline?.name}
            </span>
            <span className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" /> Formato: {FORMAT_LABELS[competition.format as keyof typeof FORMAT_LABELS] || competition.format}
            </span>
          </div>
        </div>
      </div>

      {/* `min-w-0` en cada columna: sin él, el ítem de la grilla se estira al
          ancho mínimo de la tabla y el `overflow-x-auto` nunca llega a
          scrollear, así que la página entera desbordaba a 375 px (F-40). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="card p-4 sm:p-6 md:p-8 min-w-0">
          <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Medal className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="type-h2 text-primary-900">Tabla de Posiciones</h2>
          </div>
          
          {isLoadingRankings ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : competition.format === CompetitionFormat.ELIMINACION_DIRECTA ? (
            <div className="text-center py-12 text-primary-500">
              <p>Esta competencia se juega con formato de Eliminación Directa.</p>
              <p className="text-sm mt-2">Vea el Fixture para consultar las llaves y cruces.</p>
            </div>
          ) : !rankings || rankings.length === 0 ? (
            <div className="text-center py-12 text-primary-500">
              Aún no hay resultados procesados para generar la tabla de posiciones.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left tabular-nums">
                <thead className="text-xs text-primary-500 uppercase bg-primary-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 rounded-tl-lg">#</th>
                    <th className="px-2 sm:px-4 py-3">Equipo/Participante</th>
                    <th className="px-2 sm:px-4 py-3 text-center" title="Partidos Jugados">PJ</th>
                    <th className="px-2 sm:px-4 py-3 text-center" title="Partidos Ganados">PG</th>
                    <th className="px-2 sm:px-4 py-3 text-center" title="Partidos Empatados">E</th>
                    <th className="px-2 sm:px-4 py-3 text-center hidden sm:table-cell" title="Partidos Perdidos">PP</th>
                    <th className="px-2 sm:px-4 py-3 text-center font-bold text-primary-900 rounded-tr-lg">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100">
                  {rankings.map((entry, idx) => (
                    <tr key={rankingRowKey(entry, idx)} className={idx < 3 ? 'bg-amber-50/30' : ''}>
                      <td className="px-2 sm:px-4 py-4 font-bold text-primary-900">
                        {entry.group ? `${entry.group}${entry.position ?? idx + 1}` : (entry.position ?? idx + 1)}
                      </td>
                      <td className="px-2 sm:px-4 py-4 font-medium text-primary-800 break-words">
                        {entry.name}
                      </td>
                      <td className="px-2 sm:px-4 py-4 text-center text-primary-600">{entry.played}</td>
                      <td className="px-2 sm:px-4 py-4 text-center text-primary-600">{entry.won}</td>
                      <td className="px-2 sm:px-4 py-4 text-center text-primary-600">{entry.drawn ?? 0}</td>
                      <td className="px-2 sm:px-4 py-4 text-center text-primary-600 hidden sm:table-cell">{entry.lost}</td>
                      <td className="px-2 sm:px-4 py-4 text-center font-bold text-primary-900">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-6 md:p-8 min-w-0">
          <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="type-h2 text-primary-900">Fixture y Resultados</h2>
          </div>

          <PublicFixture
            matches={competition.matches ?? []}
            resultType={competition.discipline?.resultType}
          />
        </div>
      </div>
    </div>
  );
}

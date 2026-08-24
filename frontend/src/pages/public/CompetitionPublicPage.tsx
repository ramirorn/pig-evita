import { useParams, useNavigate } from 'react-router';
import { Trophy, ArrowLeft, Loader2, Calendar, LayoutGrid, Medal, Activity } from 'lucide-react';
import { useCompetition } from '@/hooks/useCompetitions';
import { useRankings } from '@/hooks/useResults';
import { rankingRowKey } from './competition/rankingRowKey';
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
        <h2 className="text-2xl font-bold text-primary-800 mb-4">Competencia no encontrada</h2>
        <Button onClick={() => navigate('/rankings')}>Volver a Rankings</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <Button variant="ghost" className="mb-6 -ml-4" onClick={() => navigate('/rankings')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Torneos
      </Button>

      <div className="card p-8 mb-8 bg-gradient-to-br from-primary-900 to-primary-700 text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 opacity-10">
          <Trophy className="w-96 h-96" />
        </div>
        <div className="relative z-10">
          <Badge variant="outline" className="bg-white/20 text-white border-white/30 mb-4 uppercase">
            Etapa {competition.stage}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
          </h1>
          <div className="flex flex-wrap gap-6 text-primary-100 font-medium">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> {competition.discipline?.name}
            </span>
            <span className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" /> Formato: {competition.format}
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Medal className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-primary-900">Tabla de Posiciones</h2>
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
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-primary-500 uppercase bg-primary-50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">#</th>
                    <th className="px-4 py-3">Equipo/Participante</th>
                    <th className="px-4 py-3 text-center" title="Partidos Jugados">PJ</th>
                    <th className="px-4 py-3 text-center" title="Partidos Ganados">PG</th>
                    <th className="px-4 py-3 text-center font-bold text-primary-900 rounded-tr-lg">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100">
                  {rankings.map((entry, idx) => (
                    <tr key={rankingRowKey(entry)} className={idx < 3 ? 'bg-amber-50/30' : ''}>
                      <td className="px-4 py-4 font-bold text-primary-900">{entry.position}</td>
                      <td className="px-4 py-4 font-medium text-primary-800">
                        {entry.team?.name || `${entry.participant?.lastName}, ${entry.participant?.firstName}`}
                      </td>
                      <td className="px-4 py-4 text-center text-primary-600">{entry.played}</td>
                      <td className="px-4 py-4 text-center text-primary-600">{entry.won}</td>
                      <td className="px-4 py-4 text-center font-bold text-primary-900">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-primary-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-primary-900">Fixture y Resultados</h2>
          </div>

          <div className="text-center py-16 border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
            <Calendar className="w-12 h-12 text-primary-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-primary-900">Torneo en Progreso</h3>
            <p className="text-primary-500 text-sm mt-2 max-w-sm mx-auto">
              El detalle de los cruces y resultados de cada partido estará disponible próximamente en esta sección.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

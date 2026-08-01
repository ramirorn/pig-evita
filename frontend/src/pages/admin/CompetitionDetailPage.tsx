// ===========================================
// Competition Detail Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { Trophy, ArrowLeft, Loader2, Calendar, LayoutGrid, Users, Swords, CheckCircle2 } from 'lucide-react';
import { useCompetition, useGenerateFixture } from '@/hooks/useCompetitions';
import { useTeams } from '@/hooks/useTeams';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompetitionFormat } from '@/types';
import { FORMAT_LABELS, STAGE_LABELS } from '@/lib/constants';
import { toast } from 'sonner';

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: competition, isLoading } = useCompetition(id || '');
  const generateFixtureMutation = useGenerateFixture();

  // Fetch teams for this competition's discipline + category
  const { data: teamsData } = useTeams({
    disciplineId: competition?.disciplineId,
    categoryId: competition?.categoryId,
    limit: 100,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary-800">Competencia no encontrada</h2>
        <Button variant="link" onClick={() => navigate('/admin/competencias')}>Volver al listado</Button>
      </div>
    );
  }

  const availableTeams = teamsData?.data || [];
  const matches = competition.matches || [];
  const hasMatches = matches.length > 0;

  const handleGenerateFixture = async () => {
    if (availableTeams.length < 2) {
      toast.error('Se necesitan al menos 2 equipos inscriptos para generar el fixture');
      return;
    }

    try {
      const teamIds = availableTeams.map((t) => t.id);
      await generateFixtureMutation.mutateAsync({ 
        id: competition.id, 
        payload: { teamIds } 
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Group matches by round
  const matchesByRound: Record<number, typeof matches> = {};
  if (hasMatches) {
    for (const match of matches) {
      if (!matchesByRound[match.round]) matchesByRound[match.round] = [];
      matchesByRound[match.round].push(match);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/competencias')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary-800">
              {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
            </h1>
            <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200 uppercase">
              {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
            </Badge>
            <Badge variant="outline" className={
              competition.status === 'BORRADOR' ? 'bg-orange-50 text-orange-700 border-orange-200' :
              competition.status === 'ACTIVA' ? 'bg-green-50 text-green-700 border-green-200' :
              'bg-blue-50 text-blue-700 border-blue-200'
            }>
              {competition.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-sm text-primary-500 mt-2">
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4" /> {competition.discipline?.name}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {competition.category?.name}
            </span>
            <span className="flex items-center gap-1">
              <LayoutGrid className="w-4 h-4" /> {FORMAT_LABELS[competition.format as keyof typeof FORMAT_LABELS] || competition.format}
            </span>
            <span className="flex items-center gap-1">
              <Swords className="w-4 h-4" /> {availableTeams.length} equipos
            </span>
          </div>
        </div>
      </div>

      {/* Fixture section */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-primary-900 text-lg">Fixture y Partidos</h3>
          {!hasMatches && (
            <Button 
              onClick={handleGenerateFixture} 
              disabled={generateFixtureMutation.isPending || availableTeams.length < 2}
              className="gap-2"
            >
              {generateFixtureMutation.isPending ? (
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
            {Object.entries(matchesByRound).map(([round, matches]) => (
              <div key={round}>
                <h4 className="text-sm font-bold text-primary-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-black">
                    {round}
                  </span>
                  Fecha {round}
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {matches.map((match) => {
                    const results = match.results || [];
                    const home = results[0];
                    const away = results[1];
                    return (
                      <div key={match.id} className="border border-primary-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <Badge variant="outline" className={
                            match.status === 'PROGRAMADO' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                            match.status === 'EN_CURSO' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                            match.status === 'FINALIZADO' ? 'text-green-600 bg-green-50 border-green-200' :
                            'text-red-600 bg-red-50 border-red-200'
                          }>
                            {match.status}
                          </Badge>
                          <span className="text-xs text-primary-400">
                            Partido #{match.matchNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex-1 text-right">
                            <span className={`font-semibold ${home?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
                              {home?.team?.name || home?.participant?.lastName || 'Equipo Local'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 font-black text-primary-800 bg-primary-50 px-3 py-1 rounded-lg min-w-[60px] justify-center">
                            <span>{home?.scoreData && Object.values(home.scoreData)[0] !== undefined ? String(Object.values(home.scoreData)[0]) : '-'}</span>
                            <span className="text-primary-300">:</span>
                            <span>{away?.scoreData && Object.values(away.scoreData)[0] !== undefined ? String(Object.values(away.scoreData)[0]) : '-'}</span>
                          </div>
                          <div className="flex-1">
                            <span className={`font-semibold ${away?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
                              {away?.team?.name || away?.participant?.lastName || 'Equipo Visitante'}
                            </span>
                          </div>
                        </div>
                        {match.venue && (
                          <p className="text-xs text-primary-400 mt-2 text-center">
                            📍 {match.venue.name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3 border border-green-200">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                Fixture generado: {matches.length} partidos en {Object.keys(matchesByRound).length} fechas
              </span>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
            <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" />
            {competition.format === CompetitionFormat.ELIMINACION_DIRECTA ? (
              <>
                <h4 className="text-primary-800 font-medium">Llaves Eliminatorias</h4>
                <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
                  Presione "Generar Fixture Automático" para sortear los cruces eliminatorios entre los {availableTeams.length} equipos inscriptos.
                </p>
              </>
            ) : (
              <>
                <h4 className="text-primary-800 font-medium">Tabla de Liga — Todos contra todos</h4>
                <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
                  {availableTeams.length >= 2 
                    ? `Hay ${availableTeams.length} equipos disponibles. Presione "Generar Fixture Automático" para programar las fechas del Round Robin.`
                    : 'Se necesitan al menos 2 equipos inscriptos para generar el fixture.'
                  }
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Teams available */}
      {!hasMatches && availableTeams.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-primary-900 text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-500" />
            Equipos Participantes ({availableTeams.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {availableTeams.map((team) => (
              <div key={team.id} className="border border-primary-100 rounded-lg p-3 bg-primary-50/30">
                <p className="font-semibold text-primary-800 text-sm">{team.name}</p>
                <p className="text-xs text-primary-500">{team.locality}, {team.department}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


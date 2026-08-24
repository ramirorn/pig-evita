// ===========================================
// Competition Detail Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useCompetition, useGenerateFixture } from '@/hooks/useCompetitions';
import { useTeams } from '@/hooks/useTeams';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { logError } from '@/lib/logger';
import { CompetitionHeader } from './competition-detail/CompetitionHeader';
import { FixtureSection } from './competition-detail/FixtureSection';
import { AvailableTeamsCard } from './competition-detail/AvailableTeamsCard';

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
        <Button variant="link" onClick={() => navigate(ROUTES.COMPETITIONS)}>Volver al listado</Button>
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
      logError('CompetitionDetailPage.handleGenerateFixture', e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <Breadcrumbs
        items={[
          { label: 'Competencias', path: ROUTES.COMPETITIONS },
          { label: competition.name || `${competition.discipline?.name} - ${competition.category?.name}` },
        ]}
      />

      <CompetitionHeader
        competition={competition}
        teamCount={availableTeams.length}
        onBack={() => navigate(ROUTES.COMPETITIONS)}
      />

      {/* Fixture section */}
      <FixtureSection
        resultType={competition.discipline?.resultType}
        matches={matches}
        format={competition.format}
        teamCount={availableTeams.length}
        isGenerating={generateFixtureMutation.isPending}
        onGenerate={handleGenerateFixture}
      />

      {/* Teams available */}
      {!hasMatches && availableTeams.length > 0 && (
        <AvailableTeamsCard teams={availableTeams} />
      )}
    </div>
  );
}

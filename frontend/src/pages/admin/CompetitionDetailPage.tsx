// ===========================================
// Competition Detail Page
// ===========================================
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useCompetition, useGenerateFixture } from '@/hooks/useCompetitions';
import { useTeams } from '@/hooks/useTeams';
import { useApprovedInscriptionsOfCategory } from '@/hooks/useInscriptions';
import { usePermisos } from '@/hooks/usePermisos';
import { useAuth } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { RESULT_CORRECTORS } from '@/lib/roles';
import { DisciplineType } from '@/types';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { logError } from '@/lib/logger';
import { CompetitionHeader } from './competition-detail/CompetitionHeader';
import { FixtureSection } from './competition-detail/FixtureSection';
import { AvailableTeamsCard } from './competition-detail/AvailableTeamsCard';

/**
 * Detalle de una competencia.
 *
 * La pantalla la abren dos grupos (F-31): quien gestiona competencias
 * (`COMPETITION_MANAGE`: genera el fixture) y quien carga resultados
 * (`RESULT_LOAD`, que suma al ARBITRO). Para el ARBITRO es de sólo lectura más
 * la carga de cada partido: no ve la generación del fixture ni consulta
 * equipos/inscripciones, que su rol no puede leer.
 */
export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { puede } = usePermisos();
  const { user } = useAuth();

  const puedeGestionar = puede('COMPETITION_MANAGE');
  const puedeCargar = puede('RESULT_LOAD');
  const puedeCorregir = puedeCargar && !!user && RESULT_CORRECTORS.includes(user.role);
  const volverA = puedeGestionar ? ROUTES.COMPETITIONS : ROUTES.RESULTS;

  const { data: competition, isLoading } = useCompetition(id || '');
  const generateFixtureMutation = useGenerateFixture();

  const esIndividual = competition?.discipline?.type === DisciplineType.INDIVIDUAL;

  // Disciplinas de equipo: los equipos de la categoría.
  const { data: teamsData } = useTeams(
    {
      disciplineId: competition?.disciplineId,
      categoryId: competition?.categoryId,
      limit: 100,
    },
    { enabled: puedeGestionar && !!competition && !esIndividual },
  );

  // Disciplinas individuales: participantes con inscripción APROBADA (F-29).
  const { data: aprobadas } = useApprovedInscriptionsOfCategory(competition?.categoryId, {
    enabled: puedeGestionar && !!competition && esIndividual,
  });

  const participantIds = useMemo(
    // El listado de inscripciones proyecta `participant` y no `participantId`.
    () => [
      ...new Set(
        (aprobadas ?? [])
          .map((i) => i.participant?.id ?? i.participantId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    [aprobadas],
  );

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
        <h2 className="type-h2 text-primary-800">Competencia no encontrada</h2>
        <Button variant="link" onClick={() => navigate(volverA)}>Volver al listado</Button>
      </div>
    );
  }

  const availableTeams = teamsData?.data || [];
  const competidores = esIndividual ? participantIds.length : availableTeams.length;
  const unidad = esIndividual ? 'participantes' : 'equipos';
  const matches = competition.matches || [];
  const hasMatches = matches.length > 0;

  const handleGenerateFixture = async () => {
    if (competidores < 2) {
      toast.error(`Se necesitan al menos 2 ${unidad} inscriptos para generar el fixture`);
      return;
    }

    try {
      const payload = esIndividual
        ? { participantIds }
        : { teamIds: availableTeams.map((t) => t.id) };
      await generateFixtureMutation.mutateAsync({ id: competition.id, payload });
    } catch (e) {
      logError('CompetitionDetailPage.handleGenerateFixture', e);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumbs
        items={[
          puedeGestionar
            ? { label: 'Competencias', path: ROUTES.COMPETITIONS }
            : { label: 'Resultados', path: ROUTES.RESULTS },
          { label: competition.name || `${competition.discipline?.name} - ${competition.category?.name}` },
        ]}
      />

      <CompetitionHeader
        competition={competition}
        teamCount={puedeGestionar ? competidores : undefined}
        unidad={unidad}
        onBack={() => navigate(volverA)}
      />

      {/* Fixture section */}
      <FixtureSection
        resultType={competition.discipline?.resultType}
        matches={matches}
        format={competition.format}
        teamCount={competidores}
        unidad={unidad}
        isGenerating={generateFixtureMutation.isPending}
        onGenerate={handleGenerateFixture}
        puedeGestionar={puedeGestionar}
        puedeCargar={puedeCargar}
        puedeCorregir={puedeCorregir}
      />

      {/* Teams available */}
      {puedeGestionar && !esIndividual && !hasMatches && availableTeams.length > 0 && (
        <AvailableTeamsCard teams={availableTeams} />
      )}
    </div>
  );
}

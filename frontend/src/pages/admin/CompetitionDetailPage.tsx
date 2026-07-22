// ===========================================
// Competition Detail Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { Trophy, ArrowLeft, Loader2, Calendar, LayoutGrid, Users } from 'lucide-react';
import { useCompetition, useGenerateFixture } from '@/hooks/useCompetitions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompetitionFormat } from '@/types';

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: competition, isLoading } = useCompetition(id || '');
  const generateFixtureMutation = useGenerateFixture();

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

  const handleGenerateFixture = async () => {
    try {
      await generateFixtureMutation.mutateAsync({ 
        id: competition.id, 
        payload: {} 
      });
    } catch (e) {
      console.error(e);
    }
  };

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
              {competition.stage}
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
              <LayoutGrid className="w-4 h-4" /> {competition.format}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-primary-900 text-lg">Fixture y Partidos</h3>
          <Button 
            onClick={handleGenerateFixture} 
            disabled={generateFixtureMutation.isPending}
            className="gap-2"
          >
            {generateFixtureMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Generar Fixture Automático
          </Button>
        </div>

        {competition.format === CompetitionFormat.ELIMINACION_DIRECTA ? (
          <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
            <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" />
            <h4 className="text-primary-800 font-medium">Llaves Eliminatorias</h4>
            <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
              Presione "Generar Fixture Automático" para sortear los cruces eliminatorios entre los equipos inscriptos y aprobados para esta categoría.
            </p>
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
            <LayoutGrid className="w-12 h-12 text-primary-300 mx-auto mb-3" />
            <h4 className="text-primary-800 font-medium">Tabla de Liga / Grupos</h4>
            <p className="text-sm text-primary-500 mt-1 max-w-md mx-auto">
              Presione "Generar Fixture Automático" para programar las fechas del todos-contra-todos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================
// Results & Rankings Admin Page
// ===========================================
import { useState } from 'react';
import { Target, Search, Calendar, ChevronRight } from 'lucide-react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router';

export function ResultsPage() {
  const [search, setSearch] = useState('');
  
  const { data: competitionsData, isLoading } = useCompetitions();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Resultados y Rankings</h1>
            <p className="text-sm text-primary-500">Carga de resultados y visualización de tablas de posiciones</p>
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar competencia para cargar resultados..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-primary-900 border-b pb-3 mb-4 text-lg">
            Seleccione una Competencia Activa
          </h3>
          
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-6 text-primary-500">Cargando competencias...</div>
            ) : competitionsData?.data.length === 0 ? (
              <div className="text-center py-6 text-primary-500">No hay competencias activas.</div>
            ) : (
              competitionsData?.data.map((competition) => (
                <div key={competition.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border border-primary-100 rounded-lg hover:border-primary-300 transition-colors bg-white">
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary-900">
                      {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-primary-500">
                      <span className="capitalize">{competition.stage}</span>
                      <span>•</span>
                      <span className="capitalize">{competition.format}</span>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 flex items-center gap-3 w-full sm:w-auto">
                    <Link to={`/admin/competencias/${competition.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full">
                        <Calendar className="w-4 h-4 mr-2" />
                        Fixture
                      </Button>
                    </Link>
                    <Link to={`/admin/competencias/${competition.id}?tab=resultados`} className="w-full sm:w-auto">
                      <Button className="w-full">
                        Cargar Resultados <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-primary-50 to-primary-100/50 p-8 border-primary-200 flex flex-col items-center justify-center text-center">
          <Badge variant="outline" className="mb-4 bg-primary-100 text-primary-700 border-primary-200">
            Formato Dinámico
          </Badge>
          <h3 className="text-lg font-bold text-primary-900 mb-2">Ingreso de Resultados Inteligente</h3>
          <p className="text-primary-600 max-w-lg text-sm">
            La plataforma adaptará automáticamente el formato de carga (Sets, Goles, Tiempo, Puntaje, Posiciones) 
            dependiendo de la configuración de la disciplina asignada a la competencia.
          </p>
        </div>
      </div>
    </div>
  );
}

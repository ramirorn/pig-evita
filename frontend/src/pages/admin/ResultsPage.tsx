// ===========================================
// Results & Rankings Admin Page
// ===========================================
import { useState } from 'react';
import { Target, Search, ChevronRight, Loader2 } from 'lucide-react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

export function ResultsPage() {
  const [search, setSearch] = useState('');
  
  const { data: competitionsData, isLoading } = useCompetitions();

  const filtered = (competitionsData?.data || []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.discipline?.name?.toLowerCase().includes(q) ||
      c.category?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados y Rankings"
        description="Carga de resultados deportivos y visualización de tablas de posiciones"
        icon={<Target className="w-5 h-5 text-white" />}
      />

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" aria-hidden="true" />
          <Input 
            placeholder="Buscar competencia para cargar resultados..."
            aria-label="Buscar competencias"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card p-6">
        <h2 className="type-h3 text-primary-900 border-b border-primary-100 pb-3 mb-4">
          Seleccione una Competencia
        </h2>
        
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center items-center py-12 text-primary-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Target className="w-10 h-10" />}
              title="No hay competencias encontradas"
              description="No se encontraron competencias para cargar resultados."
            />
          ) : (
            filtered.map((competition) => (
              <div 
                key={competition.id} 
                className="flex flex-col sm:flex-row items-center justify-between p-4 border border-primary-100 rounded-xl bg-white gap-4"
              >
                <div className="flex-1 w-full sm:w-auto">
                  <h4 className="font-semibold text-primary-900">
                    {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs text-primary-500 mt-1">
                    <span>{competition.discipline?.name}</span>
                    <span>•</span>
                    <span>{competition.category?.name}</span>
                    <span>•</span>
                    <span className="capitalize">{competition.stage}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <Badge variant="outline" className={
                    competition.status === 'ACTIVA' ? 'bg-secondary-50 text-secondary-700 border-secondary-200' :
                    competition.status === 'BORRADOR' ? 'bg-accent-50 text-accent-800 border-accent-300' :
                    'bg-primary-50 text-primary-700 border-primary-200'
                  }>
                    {competition.status}
                  </Badge>
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to={`/admin/competencias/${competition.id}`}>
                      Cargar Resultados <ChevronRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

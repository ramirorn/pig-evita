// ===========================================
// Competitions Admin Page
// ===========================================
import { useState } from 'react';
import { Trophy, Plus, Search, Loader2 } from 'lucide-react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { CompetitionForm } from './components/CompetitionForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from 'react-router';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

export function CompetitionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: competitionsData, isLoading } = useCompetitions();

  const filteredCompetitions = competitionsData?.data.filter((c) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.discipline?.name?.toLowerCase().includes(query) ||
      c.category?.name?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Competencias"
        description="Gestión de torneos, fixtures y llaves"
        icon={<Trophy className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Crear Competencia
          </Button>
        }
      />

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar competencia por nombre, disciplina o categoría..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-10 h-10" />}
          title="No hay competencias creadas"
          description="Crea una competencia para comenzar a generar los fixtures y programar partidos."
          action={
            <Button onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Crear Primera Competencia
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompetitions.map((competition) => (
            <Link key={competition.id} to={`/admin/competencias/${competition.id}`}>
              <div className="card hover:shadow-lg hover:-translate-y-1 transition-all p-5 h-full flex flex-col cursor-pointer border-l-4 border-l-primary-500">
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-primary-900 text-lg">
                      {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
                    </h3>
                  </div>
                  <div className="space-y-1 mt-4 text-sm">
                    <div className="flex justify-between text-primary-600">
                      <span>Disciplina:</span>
                      <span className="font-medium">{competition.discipline?.name}</span>
                    </div>
                    <div className="flex justify-between text-primary-600">
                      <span>Categoría:</span>
                      <span className="font-medium">{competition.category?.name}</span>
                    </div>
                    <div className="flex justify-between text-primary-600">
                      <span>Etapa:</span>
                      <span className="font-medium capitalize">{competition.stage}</span>
                    </div>
                    <div className="flex justify-between text-primary-600">
                      <span>Formato:</span>
                      <span className="font-medium capitalize">{competition.format}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-primary-100">
                  <span className="text-primary-600 text-sm font-medium hover:text-primary-800">
                    Ver Fixture y Partidos &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Nueva Competencia</DialogTitle>
          </DialogHeader>
          <CompetitionForm onSuccess={() => setIsModalOpen(false)} onCancel={() => setIsModalOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

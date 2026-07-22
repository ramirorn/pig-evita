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

export function CompetitionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: competitionsData, isLoading } = useCompetitions();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Competencias</h1>
            <p className="text-sm text-primary-500">Gestión de torneos, fixtures y llaves</p>
          </div>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Crear Competencia
        </Button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar competencia por nombre o disciplina..." 
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitionsData?.data.map((competition) => (
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
                  <span className="text-primary-500 text-sm font-medium hover:text-primary-700">
                    Ver Fixture y Partidos &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {competitionsData?.data.length === 0 && (
            <div className="col-span-full card py-12 text-center">
              <Trophy className="w-12 h-12 text-primary-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-primary-900">No hay competencias creadas</h3>
              <p className="text-primary-500 mt-1">Crea una competencia para comenzar a generar los fixtures.</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsModalOpen(true)}>
                Crear Primera Competencia
              </Button>
            </div>
          )}
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

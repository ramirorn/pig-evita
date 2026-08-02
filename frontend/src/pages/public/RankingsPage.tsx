// ===========================================
// Rankings Page — Public
// ===========================================
import { Medal, Loader2, CalendarDays, Search, Trophy } from 'lucide-react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { STAGE_LABELS, COMPETITION_STATUS_LABELS } from '@/lib/constants';
import type { CompetitionStatus } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  ACTIVA: 'bg-secondary-50 text-secondary-700 border-secondary-200',
  FINALIZADA: 'bg-primary-50 text-primary-700 border-primary-200',
  BORRADOR: 'bg-primary-50 text-primary-400 border-primary-100',
};

export function RankingsPage() {
  const [search, setSearch] = useState('');
  const { data: competitionsData, isLoading } = useCompetitions();

  const filteredCompetitions = competitionsData?.data.filter(comp =>
    comp.status !== 'BORRADOR' &&
    (comp.name?.toLowerCase().includes(search.toLowerCase()) ||
    comp.discipline?.name?.toLowerCase().includes(search.toLowerCase()) ||
    comp.category?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <PageHero
        title="Rankings y Resultados"
        description="Tablas de posiciones, fixtures y resultados actualizados de todas las competencias activas en Formosa."
        icon={<Medal className="w-8 h-8 text-primary-950" />}
        variant="accent"
      >
        {/* Search bar inside hero */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
          <Input
            className="pl-12 h-12 text-base rounded-2xl border-white/20 bg-white/95 text-primary-900 placeholder:text-primary-400 focus-visible:ring-accent-500 shadow-lg"
            placeholder="Buscar torneo, disciplina o categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : filteredCompetitions && filteredCompetitions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompetitions.map((competition, idx) => (
              <Link
                key={competition.id}
                to={`/competencias/${competition.id}`}
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="card p-6 h-full hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between border-t-4 border-t-accent-500">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border',
                          STATUS_BADGE[competition.status] || 'bg-primary-50 text-primary-700 border-primary-200',
                        )}
                      >
                        {COMPETITION_STATUS_LABELS[competition.status as CompetitionStatus] || competition.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-primary-900 mb-3">
                      {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
                    </h3>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-primary-600">
                        <span>Disciplina:</span>
                        <span className="font-semibold text-primary-800">{competition.discipline?.name}</span>
                      </div>
                      <div className="flex justify-between text-primary-600">
                        <span>Categoría:</span>
                        <span className="font-semibold text-primary-800">{competition.category?.name}</span>
                      </div>
                      <div className="flex justify-between text-primary-600">
                        <span>Etapa:</span>
                        <span className="font-semibold capitalize text-primary-800">
                          {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-primary-100 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md">
                      <CalendarDays className="w-3.5 h-3.5 text-primary-600" /> Ver Fixture
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md">
                      <Medal className="w-3.5 h-3.5 text-accent-500" /> Posiciones
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="w-10 h-10" />}
            title="Sin competencias"
            description="No se encontraron competencias activas con los filtros aplicados."
          />
        )}
      </div>
    </div>
  );
}

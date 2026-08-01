import { Medal, Loader2, CalendarDays, Search } from 'lucide-react';
import { useCompetitions } from '@/hooks/useCompetitions';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg">
          <Medal className="w-8 h-8 text-primary-950" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800 mb-4 tracking-tight">Rankings y Resultados</h1>
        <p className="text-primary-600 max-w-2xl mx-auto text-lg">
          Tablas de posiciones, fixtures y resultados actualizados de todas las competencias activas en Formosa.
        </p>
      </div>

      <div className="max-w-xl mx-auto mb-10 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
        <Input 
          className="pl-12 h-12 text-base rounded-2xl border-primary-200 focus-visible:ring-primary-500 bg-white shadow-xs"
          placeholder="Buscar torneo, disciplina o categoría..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompetitions?.map((competition) => (
            <Link key={competition.id} to={`/competencias/${competition.id}`}>
              <div className="card p-6 h-full hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between border-t-4 border-t-accent-500">
                <div>
                  <h3 className="text-xl font-bold text-primary-900 mb-2">
                    {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
                  </h3>
                  <div className="space-y-1 mt-4 text-sm">
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
                      <span className="font-semibold capitalize text-primary-800">{competition.stage}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-primary-100 flex items-center justify-between text-primary-600 group-hover:text-primary-800 font-medium">
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

          {filteredCompetitions?.length === 0 && (
            <div className="col-span-full py-12 text-center text-primary-500 bg-white rounded-2xl border border-primary-100">
              No se encontraron competencias activas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

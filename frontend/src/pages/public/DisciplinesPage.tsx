import { Trophy, Loader2, ArrowRight } from 'lucide-react';
import { useDisciplines } from '@/hooks/useDisciplines';
import { Link } from 'react-router';
export function DisciplinesPage() {
  const { data: disciplinesData, isLoading } = useDisciplines({ isActive: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800 mb-4">Disciplinas Deportivas</h1>
        <p className="text-primary-600 max-w-2xl mx-auto text-lg">
          Conocé todas las disciplinas disponibles en los Juegos Evita Formosa. 
          Encontrá el deporte que te apasiona y sumate a competir.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {disciplinesData?.data.map((discipline) => (
            <Link key={discipline.id} to={`/disciplinas/${discipline.id}`}>
              <div className="card h-full p-6 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4 group-hover:bg-primary-500 transition-colors">
                  <Trophy className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-primary-900 text-lg mb-2">{discipline.name}</h3>
                <p className="text-primary-500 text-sm mb-4 line-clamp-2">
                  {discipline.type}
                </p>
                <div className="mt-auto">
                  <span className="text-primary-600 font-medium text-sm flex items-center group-hover:text-primary-800">
                    Ver reglamento y categorías <ArrowRight className="w-4 h-4 ml-1" />
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {disciplinesData?.data.length === 0 && (
            <div className="col-span-full py-12 text-center text-primary-500 bg-white rounded-2xl border border-primary-100">
              No hay disciplinas activas en este momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================
// Disciplines Page — Public
// ===========================================
import { useState } from 'react';
import {
  Trophy, Loader2, ArrowRight,
  Dumbbell, Bike, Target, Swords, Volleyball,
  Footprints, Waves, Wind, Flame, CircleDot, Gamepad2,
} from 'lucide-react';
import { useDisciplines } from '@/hooks/useDisciplines';
import { Link } from 'react-router';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { DisciplineType } from '@/types';
import { cn } from '@/lib/utils';

// Map discipline names to specific icons for visual variety
const DISCIPLINE_ICONS: Record<string, React.ReactNode> = {
  'Fútbol 11': <CircleDot className="w-6 h-6" />,
  'Fútbol': <CircleDot className="w-6 h-6" />,
  'Atletismo': <Footprints className="w-6 h-6" />,
  'Natación': <Waves className="w-6 h-6" />,
  'Ciclismo': <Bike className="w-6 h-6" />,
  'Tiro': <Target className="w-6 h-6" />,
  'Esgrima': <Swords className="w-6 h-6" />,
  'Vóley': <Volleyball className="w-6 h-6" />,
  'Volleyball': <Volleyball className="w-6 h-6" />,
  'Pesas': <Dumbbell className="w-6 h-6" />,
  'Halterofilia': <Dumbbell className="w-6 h-6" />,
  'Karate': <Wind className="w-6 h-6" />,
  'Taekwondo': <Flame className="w-6 h-6" />,
  'Ajedrez': <Gamepad2 className="w-6 h-6" />,
};

function getDisciplineIcon(name: string): React.ReactNode {
  // Try exact match first, then partial match
  if (DISCIPLINE_ICONS[name]) return DISCIPLINE_ICONS[name];
  const key = Object.keys(DISCIPLINE_ICONS).find((k) =>
    name.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? DISCIPLINE_ICONS[key] : <Trophy className="w-6 h-6" />;
}

// Alternating gradient backgrounds for cards
const CARD_GRADIENTS = [
  'from-primary-500 to-primary-700',
  'from-secondary-500 to-secondary-600',
  'from-accent-500 to-accent-600',
  'from-celeste-500 to-celeste-600',
  'from-primary-600 to-primary-800',
  'from-secondary-600 to-secondary-700',
];

type FilterType = 'ALL' | 'INDIVIDUAL' | 'EQUIPO';

export function DisciplinesPage() {
  const { data: disciplinesData, isLoading } = useDisciplines({ isActive: true });
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filtered = disciplinesData?.data.filter((d) =>
    filter === 'ALL' ? true : d.type === filter,
  );

  const FILTERS: { label: string; value: FilterType }[] = [
    { label: 'Todas', value: 'ALL' },
    { label: 'Individual', value: 'INDIVIDUAL' },
    { label: 'Equipo', value: 'EQUIPO' },
  ];

  return (
    <div>
      <PageHero
        title="Disciplinas Deportivas"
        description="Conocé todas las disciplinas disponibles en los Juegos Evita Formosa. Encontrá el deporte que te apasiona y sumate a competir."
        icon={<Trophy className="w-8 h-8 text-white" />}
        variant="primary"
      >
        {/* Filter tabs */}
        <div className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/15">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                filter === f.value
                  ? 'bg-white text-primary-800 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((discipline, idx) => (
              <Link key={discipline.id} to={`/disciplinas/${discipline.id}`}>
                <div
                  className={`card h-full p-6 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center animate-fade-in`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-all duration-300',
                      'bg-primary-100 text-primary-600 group-hover:text-white',
                      `group-hover:bg-gradient-to-br group-hover:${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}`,
                    )}
                    style={{
                      // Using inline style for dynamic group-hover gradient since TW can't do it dynamically
                    }}
                  >
                    <div className="group-hover:scale-110 transition-transform">
                      {getDisciplineIcon(discipline.name)}
                    </div>
                  </div>
                  <h3 className="font-bold text-primary-900 text-lg mb-2">{discipline.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-3',
                      discipline.type === DisciplineType.INDIVIDUAL
                        ? 'bg-celeste-50 text-celeste-700 border border-celeste-200'
                        : 'bg-secondary-50 text-secondary-700 border border-secondary-200',
                    )}
                  >
                    {discipline.type === DisciplineType.INDIVIDUAL ? 'Individual' : 'Equipo'}
                  </span>
                  <div className="mt-auto pt-2">
                    <span className="text-primary-600 font-medium text-sm flex items-center justify-center gap-1 group-hover:text-primary-800 transition-colors">
                      Ver reglamento y categorías <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Trophy className="w-10 h-10" />}
            title="Sin disciplinas"
            description="No hay disciplinas activas en este momento."
          />
        )}
      </div>
    </div>
  );
}

// ===========================================
// Disciplines Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicListState } from '@/components/shared/PublicListState';
import { CardGridSkeleton } from '@/components/shared/CardGridSkeleton';
import { DisciplineCard } from './disciplines/DisciplineCard';
import { cn } from '@/lib/utils';
import { columnasSegunVolumen } from '@/lib/gridVolumen';

type FilterType = 'ALL' | 'INDIVIDUAL' | 'EQUIPO';

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Individual', value: 'INDIVIDUAL' },
  { label: 'Equipo', value: 'EQUIPO' },
];

export function DisciplinesPage() {
  // Recorre la paginación hasta el final (R29/S06/S13): antes era
  // `useDisciplines({ isActive: true })` sin `limit`, o sea las 20 filas del
  // default del backend, y los chips de abajo filtraban **en memoria** sobre
  // esas 20. Con 21 disciplinas la última no existía para esta página y nada
  // lo indicaba.
  const { data: disciplines, isLoading } = useAllDisciplines({ isActive: true });
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filtered = useMemo(
    () => (disciplines ?? []).filter((d) => (filter === 'ALL' ? true : d.type === filter)),
    [disciplines, filter],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <PublicPageHeader
        title="Disciplinas Deportivas"
        description="Todas las disciplinas disponibles en los Juegos Evita Formoseños. Encontrá el deporte que te apasiona y sumate a competir."
        icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
      />

      {/* Los filtros van debajo del encabezado y no como `actions`:
          pertenecen al listado, no al título. */}
      <div role="group" aria-label="Filtrar disciplinas" className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              // `min-h-11` = 44 px, el blanco de toque de WCAG 2.5.5. Con
              // `py-2` quedaban en 36, y este sitio se consume sobre todo
              // desde el celular.
              'inline-flex min-h-11 items-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors',
              filter === f.value
                ? 'bg-primary-800 text-white'
                // El borde es la única señal de dónde termina el control:
                // `primary-200` sobre blanco da 1.73:1 y `primary-300` 2.48:1,
                // los dos por debajo del 3:1 que AA pide para el borde de un
                // control. `primary-400` da 3.75:1.
                : 'border border-primary-400 bg-white text-primary-600 hover:bg-primary-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <PublicListState
        isLoading={isLoading}
        isEmpty={filtered.length === 0}
        skeleton={<CardGridSkeleton cantidad={6} alto="h-64" />}
        empty={
          <EmptyState
            icon={<Trophy className="w-10 h-10" />}
            title="Sin disciplinas"
            description={
              filter === 'ALL'
                ? 'No hay disciplinas activas en este momento.'
                : 'No hay disciplinas activas de ese tipo.'
            }
          />
        }
      >
        {/* El reparto de columnas es función del volumen: con las 5 disciplinas
            cargadas, `xl:grid-cols-4` dejaba una fila de 4 y una huérfana. */}
        <div className={columnasSegunVolumen(filtered.length)}>
          {filtered.map((discipline, idx) => (
            <DisciplineCard key={discipline.id} discipline={discipline} index={idx} />
          ))}
        </div>
      </PublicListState>
    </div>
  );
}

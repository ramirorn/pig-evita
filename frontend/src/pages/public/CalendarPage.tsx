// ===========================================
// Calendar Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';
import { useDisciplines } from '@/hooks/useDisciplines';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { CalendarFiltersPanel } from './calendar/CalendarFiltersPanel';
import { CalendarEventCard } from './calendar/CalendarEventCard';
import {
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEvents,
  hasActiveCalendarFilters,
  type CalendarPageFilters,
} from './calendar/calendarFilters';

export function CalendarPage() {
  const [filters, setFilters] = useState<CalendarPageFilters>(EMPTY_CALENDAR_FILTERS);

  // Traer hasta 100 eventos publicados para el calendario
  const { data: calendarData, isLoading } = useCalendarEvents({ isPublished: true, limit: 100 });
  const { data: disciplinesData } = useDisciplines({ isActive: true });

  const disciplines = disciplinesData?.data || [];

  // Filtrado reactivo en el cliente
  const filteredEvents = useMemo(
    () => filterCalendarEvents(calendarData?.data ?? [], filters),
    [calendarData, filters],
  );

  const hasActiveFilters = hasActiveCalendarFilters(filters);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <PageHero
        title="Calendario de Eventos"
        description="Conocé las fechas, horarios y sedes de las próximas competencias de los Juegos Evita Formosa."
        icon={<CalendarDays className="w-8 h-8 text-white" />}
        variant="secondary"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Panel de Filtros Moderno */}
        <CalendarFiltersPanel
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onReset={() => setFilters(EMPTY_CALENDAR_FILTERS)}
          hasActiveFilters={hasActiveFilters}
          disciplines={disciplines}
          resultCount={filteredEvents.length}
        />

        {/* Lista del Timeline */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="relative">
            {filteredEvents.map((event, idx) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                index={idx}
                isLast={idx === filteredEvents.length - 1}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays className="w-10 h-10" />}
            title="Sin eventos encontrados"
            description={
              hasActiveFilters
                ? 'No se encontraron eventos con los filtros seleccionados. Probá modificando los criterios de búsqueda.'
                : 'No hay eventos programados en este momento. ¡Próximamente se publicará el calendario!'
            }
          />
        )}
      </div>
    </div>
  );
}

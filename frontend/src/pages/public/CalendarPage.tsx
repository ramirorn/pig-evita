// ===========================================
// Calendar Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { CalendarFiltersPanel } from './calendar/CalendarFiltersPanel';
import { CalendarEventCard } from './calendar/CalendarEventCard';
import {
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEvents,
  hasActiveCalendarFilters,
  opcionesDeMes,
  type CalendarPageFilters,
} from './calendar/calendarFilters';
import { MONTH_NAMES } from './calendar/eventStageStyles';

export function CalendarPage() {
  const [filters, setFilters] = useState<CalendarPageFilters>(EMPTY_CALENDAR_FILTERS);

  // Todos los eventos publicados, recorriendo la paginación hasta el final: el
  // `limit: 100` que había acá era el tope duro del backend disfrazado de
  // "traeme todo", y los filtros de abajo corren en memoria (R29).
  const { data: calendarEvents, isLoading } = useAllCalendarEvents({ isPublished: true });
  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplinesData } = useAllDisciplines({ isActive: true });

  const disciplines = disciplinesData ?? [];

  // Filtrado reactivo en el cliente
  const allEvents = useMemo(() => calendarEvents ?? [], [calendarEvents]);

  const filteredEvents = useMemo(
    () => filterCalendarEvents(allEvents, filters),
    [allEvents, filters],
  );

  // Sólo los meses que tienen algún evento, con su año.
  const monthOptions = useMemo(() => opcionesDeMes(allEvents, MONTH_NAMES), [allEvents]);

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
          monthOptions={monthOptions}
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

// ===========================================
// Calendar Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllVenues } from '@/hooks/useVenues';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicListState } from '@/components/shared/PublicListState';
import { CardGridSkeleton } from '@/components/shared/CardGridSkeleton';
import { CalendarFiltersPanel } from './calendar/CalendarFiltersPanel';
import { CalendarEventCard } from './calendar/CalendarEventCard';
import {
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEvents,
  hasActiveCalendarFilters,
  opcionesDeMes,
  type CalendarPageFilters,
} from './calendar/calendarFilters';
import { esMismoDia, repartirPorFecha } from './calendar/calendarSecciones';
import { MONTH_NAMES } from './calendar/eventStageStyles';
import type { CalendarEvent } from '@/types';

export function CalendarPage() {
  const [filters, setFilters] = useState<CalendarPageFilters>(EMPTY_CALENDAR_FILTERS);

  // Todos los eventos publicados, recorriendo la paginación hasta el final: el
  // `limit: 100` que había acá era el tope duro del backend disfrazado de
  // "traeme todo", y los filtros de abajo corren en memoria (R29).
  const { data: calendarEvents, isLoading } = useAllCalendarEvents({ isPublished: true });
  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplinesData } = useAllDisciplines({ isActive: true });
  // Las sedes hacen falta para resolver `event.venueId` a un nombre. Son un
  // catálogo chico con `STALE_TIME.CATALOG` y la misma clave de query que usa
  // la página de sedes, así que navegar entre las dos no dispara nada nuevo.
  const { data: venuesData } = useAllVenues({ isActive: true });

  // Se memoiza porque el `?? []` crea un arreglo nuevo en cada render, y de él
  // depende el mapa de resolución de disciplinas: sin esto el `useMemo` de más
  // abajo se recalcula siempre y deja de ser un `useMemo`.
  const disciplines = useMemo(() => disciplinesData ?? [], [disciplinesData]);

  /**
   * Los dos mapas de resolución.
   *
   * ⚠️ Esto es un cruce **en el cliente** y no un `include` del backend porque
   * `CalendarEvent` no tiene `@relation` con `Venue` ni con `Discipline` en
   * `schema.prisma`: hay un `venueId` y un `disciplineId` sueltos. La API no
   * puede devolver `event.venue.name` porque no existe la relación que
   * incluir. Aguanta bien mientras sedes y disciplinas sean catálogos chicos;
   * si algún día hay cientos de sedes, la salida es la migración anotada como
   * U13, no agrandar esto.
   */
  const sedesPorId = useMemo(
    () => new Map((venuesData ?? []).map((v) => [v.id, v.name])),
    [venuesData],
  );
  const disciplinasPorId = useMemo(
    () => new Map(disciplines.map((d) => [d.id, d.name])),
    [disciplines],
  );

  const allEvents = useMemo(() => calendarEvents ?? [], [calendarEvents]);

  const filteredEvents = useMemo(
    () => filterCalendarEvents(allEvents, filters),
    [allEvents, filters],
  );

  // Sólo los meses que tienen algún evento, con su año.
  const monthOptions = useMemo(() => opcionesDeMes(allEvents, MONTH_NAMES), [allEvents]);

  const hasActiveFilters = hasActiveCalendarFilters(filters);

  const hoy = useMemo(() => new Date(), []);
  const { proximos, pasados } = useMemo(
    () => repartirPorFecha(filteredEvents, hoy),
    [filteredEvents, hoy],
  );

  /** Pinta una sección con su `h2`. Los eventos son `h3` y cuelgan de él. */
  const seccion = (titulo: string, eventos: CalendarEvent[], esPasado: boolean) => (
    <section className="mb-12 last:mb-0">
      <h2 className="mb-6 text-lg font-bold uppercase tracking-wide text-primary-700">
        {titulo}{' '}
        <span className="font-semibold text-primary-600">({eventos.length})</span>
      </h2>
      <div className="relative">
        {eventos.map((event, idx) => (
          <CalendarEventCard
            key={event.id}
            event={event}
            index={idx}
            isLast={idx === eventos.length - 1}
            nombreDeSede={(event.venueId && sedesPorId.get(event.venueId)) || null}
            nombreDeDisciplina={
              (event.disciplineId && disciplinasPorId.get(event.disciplineId)) || null
            }
            esPasado={esPasado}
            esHoy={!esPasado && esMismoDia(new Date(event.startDate), hoy)}
          />
        ))}
      </div>
    </section>
  );

  return (
    // `max-w-7xl` como las otras tres páginas: con `max-w-5xl` el contenido
    // saltaba de ancho al navegar entre secciones. El timeline queda acotado
    // por dentro, que es donde el ancho sí importa para leerlo.
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <PublicPageHeader
        title="Calendario de Eventos"
        description="Fechas, horarios y sedes de las próximas competencias de los Juegos Evita Formoseños."
        icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
      />

      <CalendarFiltersPanel
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(EMPTY_CALENDAR_FILTERS)}
        hasActiveFilters={hasActiveFilters}
        disciplines={disciplines}
        resultCount={filteredEvents.length}
        monthOptions={monthOptions}
      />

      <PublicListState
        isLoading={isLoading}
        isEmpty={filteredEvents.length === 0}
        skeleton={<CardGridSkeleton cantidad={3} alto="h-40" />}
        empty={
          <EmptyState
            icon={<CalendarDays className="w-10 h-10" />}
            title="Sin eventos encontrados"
            description={
              hasActiveFilters
                ? 'No se encontraron eventos con los filtros seleccionados. Probá modificando los criterios de búsqueda.'
                : 'No hay eventos programados en este momento. ¡Próximamente se publicará el calendario!'
            }
          />
        }
      >
        <div className="max-w-5xl">
          {/* Una sección vacía no se renderiza: un "Ya se disputaron (0)" es
              peor que su ausencia — mismo argumento que `newsLayout.ts` sobre
              la sección "Más artículos". */}
          {proximos.length > 0 && seccion('Próximos eventos', proximos, false)}
          {pasados.length > 0 && seccion('Ya se disputaron', pasados, true)}
        </div>
      </PublicListState>
    </div>
  );
}

// ===========================================
// Calendar Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, RotateCcw } from 'lucide-react';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllVenues } from '@/hooks/useVenues';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicListState } from '@/components/shared/PublicListState';
import { Button } from '@/components/ui/button';
import { CalendarFiltersPanel } from './calendar/CalendarFiltersPanel';
import { CalendarAgenda, CalendarAgendaSkeleton } from './calendar/CalendarAgenda';
import {
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEvents,
  hasActiveCalendarFilters,
  opcionesDeMes,
  type CalendarPageFilters,
} from './calendar/calendarFilters';
import { repartirPorFecha } from './calendar/calendarSecciones';
import { MONTH_NAMES } from './calendar/eventStageStyles';
import type { CalendarEvent } from '@/types';

export function CalendarPage() {
  const [filters, setFilters] = useState<CalendarPageFilters>(EMPTY_CALENDAR_FILTERS);

  // Todos los eventos publicados, recorriendo la paginación hasta el final: el
  // `limit: 100` que había acá era el tope duro del backend disfrazado de
  // "traeme todo", y los filtros de abajo corren en memoria (R29).
  const {
    data: calendarEvents,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useAllCalendarEvents({ isPublished: true });
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

  const nombreDeSede = (event: CalendarEvent) =>
    (event.venueId && sedesPorId.get(event.venueId)) || null;
  const nombreDeDisciplina = (event: CalendarEvent) =>
    (event.disciplineId && disciplinasPorId.get(event.disciplineId)) || null;

  /**
   * Pinta una sección con su `h2`, en formato agenda por mes: cada mes es un
   * `h3` que cuelga de él.
   */
  const seccion = (titulo: string, eventos: CalendarEvent[], esPasado: boolean) => (
    <section className="mb-12 last:mb-0">
      <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-primary-700">
        {titulo}{' '}
        <span className="font-semibold text-primary-600">({eventos.length})</span>
      </h2>
      <CalendarAgenda
        eventos={eventos}
        nombreDeSede={nombreDeSede}
        nombreDeDisciplina={nombreDeDisciplina}
        esPasado={esPasado}
        hoy={hoy}
      />
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

      {isError ? (
        <EmptyState
          icon={<AlertTriangle className="w-10 h-10" />}
          title="No pudimos cargar el calendario"
          description="Puede ser un problema de conexión. Probá de nuevo en unos segundos."
          action={
            <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
          }
        />
      ) : (
      <PublicListState
        isLoading={isLoading}
        isEmpty={filteredEvents.length === 0}
        skeleton={<CalendarAgendaSkeleton />}
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
        <div className="max-w-4xl">
          {/* Una sección vacía no se renderiza: un "Ya se disputaron (0)" es
              peor que su ausencia — mismo argumento que `newsLayout.ts` sobre
              la sección "Más artículos". */}
          {proximos.length > 0 && seccion('Próximos eventos', proximos, false)}
          {pasados.length > 0 && seccion('Ya se disputaron', pasados, true)}
        </div>
      </PublicListState>
      )}
    </div>
  );
}

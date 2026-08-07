// ===========================================
// Calendar Page — Public
// ===========================================
import { useState, useMemo } from 'react';
import { CalendarDays, Loader2, Clock, Trophy, Sparkles, Search, Filter, X, RotateCcw } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';
import { useDisciplines } from '@/hooks/useDisciplines';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface StageStyle {
  badge: string;
  dot: string;
  stripe: string;
}

const STAGE_STYLES: Record<string, StageStyle> = {
  ZONAL: {
    badge: 'bg-celeste-50 text-celeste-800 border-celeste-300',
    dot: 'border-celeste-500 bg-celeste-500',
    stripe: 'bg-celeste-500',
  },
  DEPARTAMENTAL: {
    badge: 'bg-accent-50 text-accent-800 border-accent-300',
    dot: 'border-accent-500 bg-accent-500',
    stripe: 'bg-accent-500',
  },
  PROVINCIAL: {
    badge: 'bg-secondary-50 text-secondary-800 border-secondary-300',
    dot: 'border-secondary-500 bg-secondary-500',
    stripe: 'bg-secondary-500',
  },
};

const DEFAULT_STYLE: StageStyle = {
  badge: 'bg-primary-50 text-primary-800 border-primary-300',
  dot: 'border-primary-500 bg-primary-500',
  stripe: 'bg-primary-500',
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function CalendarPage() {
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');

  // Traer hasta 100 eventos publicados para el calendario
  const { data: calendarData, isLoading } = useCalendarEvents({ isPublished: true, limit: 100 });
  const { data: disciplinesData } = useDisciplines({ isActive: true });

  const disciplines = disciplinesData?.data || [];

  // Filtrado reactivo en el cliente
  const filteredEvents = useMemo(() => {
    if (!calendarData?.data) return [];

    return calendarData.data.filter((event) => {
      const date = new Date(event.startDate);
      const eventMonth = date.getMonth().toString();

      // Filtro por texto
      const matchesSearch =
        search === '' ||
        event.title.toLowerCase().includes(search.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(search.toLowerCase()));

      // Filtro por etapa
      const matchesStage = selectedStage === 'ALL' || event.stage === selectedStage;

      // Filtro por mes
      const matchesMonth = selectedMonth === 'ALL' || eventMonth === selectedMonth;

      // Filtro por disciplina
      const matchesDiscipline = selectedDiscipline === 'ALL' || event.disciplineId === selectedDiscipline;

      return matchesSearch && matchesStage && matchesMonth && matchesDiscipline;
    });
  }, [calendarData, search, selectedStage, selectedMonth, selectedDiscipline]);

  const hasActiveFilters = search !== '' || selectedStage !== 'ALL' || selectedMonth !== 'ALL' || selectedDiscipline !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setSelectedStage('ALL');
    setSelectedMonth('ALL');
    setSelectedDiscipline('ALL');
  };

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
        <div className="bg-white rounded-2xl border border-primary-100 p-5 shadow-sm mb-10">
          <div className="flex items-center gap-2 mb-4 text-primary-900 font-bold text-base">
            <Filter className="w-4 h-4 text-primary-600" />
            <span>Filtrar Cronograma</span>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-semibold px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
              <Input
                placeholder="Buscar evento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm rounded-xl border-primary-200 focus-visible:ring-primary-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selector de Mes */}
            <div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Filtrar por Mes"
                className="w-full h-10 px-3 text-sm rounded-xl border border-primary-200 bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium cursor-pointer"
              >
                <option value="ALL">Todos los meses</option>
                {MONTH_NAMES.map((monthName, idx) => (
                  <option key={idx} value={idx.toString()}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Etapa */}
            <div>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                aria-label="Filtrar por Etapa"
                className="w-full h-10 px-3 text-sm rounded-xl border border-primary-200 bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium cursor-pointer"
              >
                <option value="ALL">Todas las etapas</option>
                <option value="ZONAL">Etapa Zonal</option>
                <option value="DEPARTAMENTAL">Etapa Departamental</option>
                <option value="PROVINCIAL">Etapa Provincial</option>
              </select>
            </div>

            {/* Selector de Disciplina */}
            <div>
              <select
                value={selectedDiscipline}
                onChange={(e) => setSelectedDiscipline(e.target.value)}
                aria-label="Filtrar por Deporte o Disciplina"
                className="w-full h-10 px-3 text-sm rounded-xl border border-primary-200 bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium cursor-pointer"
              >
                <option value="ALL">Todas las disciplinas</option>
                {disciplines.map((disc) => (
                  <option key={disc.id} value={disc.id}>
                    {disc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estado de resultados */}
          <div className="mt-3.5 pt-3 border-t border-primary-50 flex items-center justify-between text-xs text-primary-600 font-medium">
            <span>
              Mostrando <strong className="text-primary-900">{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'evento encontrado' : 'eventos encontrados'}
            </span>
          </div>
        </div>

        {/* Lista del Timeline */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="relative">
            {filteredEvents.map((event, idx) => {
              const date = new Date(event.startDate);
              const stageStyle = (event.stage && STAGE_STYLES[event.stage]) || DEFAULT_STYLE;
              const isLast = idx === filteredEvents.length - 1;

              return (
                <div
                  key={event.id}
                  className="group relative flex flex-col md:flex-row items-stretch gap-4 md:gap-8 pb-10 last:pb-0 animate-fade-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  {/* Columna Izquierda: Tarjeta de Fecha */}
                  <div className="w-full md:w-44 flex-shrink-0 flex md:justify-end">
                    <div className="w-full bg-white rounded-2xl border border-primary-100 shadow-sm group-hover:shadow-md group-hover:border-primary-200 transition-all duration-300 overflow-hidden flex flex-col">
                      {/* Cabecera del día */}
                      <div className="bg-gradient-to-r from-primary-800 to-primary-700 text-white py-1.5 px-3 text-center">
                        <span className="font-bold uppercase tracking-wider text-xs block">
                          {date.toLocaleDateString('es-AR', { weekday: 'long' })}
                        </span>
                      </div>
                      {/* Cuerpo de la fecha */}
                      <div className="p-4 flex flex-col items-center justify-center flex-1 bg-white">
                        <span className="text-4xl md:text-5xl font-black text-primary-900 tracking-tight leading-none">
                          {date.getDate()}
                        </span>
                        <span className="text-primary-700 font-semibold text-sm capitalize mt-1">
                          {date.toLocaleDateString('es-AR', { month: 'long' })}
                        </span>
                        <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100/80">
                          <Clock className="w-3.5 h-3.5 text-primary-500" />
                          <span>
                            {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna Central: Eje y Nodo de Conexión (Timeline) */}
                  <div className="hidden md:flex flex-col items-center relative w-8 flex-shrink-0">
                    {/* Línea vertical continua */}
                    <div
                      className={cn(
                        'w-0.5 bg-gradient-to-b from-primary-200 via-celeste-300 to-primary-200 absolute top-0 bottom-0 left-1/2 -translate-x-1/2',
                        idx === 0 && 'top-6',
                        isLast && 'bottom-[calc(100%-2.5rem)]',
                      )}
                    />

                    {/* Nodo de hito conectado */}
                    <div className="relative z-10 w-7 h-7 rounded-full bg-white border-2 border-primary-500 shadow-md flex items-center justify-center mt-6 group-hover:scale-110 group-hover:border-accent-500 transition-all duration-300">
                      <span className={cn('w-2.5 h-2.5 rounded-full transition-colors duration-300', stageStyle.dot)} />
                    </div>
                  </div>

                  {/* Columna Derecha: Tarjeta de Contenido del Evento */}
                  <div className="flex-1 bg-white rounded-2xl p-6 border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group/card">
                    {/* Franja lateral de acento de color de la etapa */}
                    <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', stageStyle.stripe)} />

                    <div>
                      {/* Fila superior: Título y Badges */}
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <h3 className="text-xl font-bold text-primary-900 group-hover/card:text-primary-700 transition-colors leading-snug">
                          {event.title}
                        </h3>

                        {event.stage && (
                          <span
                            className={cn(
                              'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-xs flex-shrink-0',
                              stageStyle.badge,
                            )}
                          >
                            Etapa {event.stage.charAt(0) + event.stage.slice(1).toLowerCase()}
                          </span>
                        )}
                      </div>

                      {/* Descripción */}
                      {event.description ? (
                        <p className="text-primary-600 text-sm leading-relaxed mb-4">
                          {event.description}
                        </p>
                      ) : (
                        <p className="text-primary-400 italic text-xs mb-4">
                          Evento oficial del cronograma de los Juegos Evita Formosa.
                        </p>
                      )}
                    </div>

                    {/* Fila inferior de metadata complementaria */}
                    <div className="pt-3 border-t border-primary-50 flex flex-wrap items-center gap-4 text-xs font-medium text-primary-600">
                      <div className="flex items-center gap-1.5 text-primary-700">
                        <Trophy className="w-3.5 h-3.5 text-accent-500" />
                        <span>Competencia Oficial</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-primary-500 ml-auto">
                        <Sparkles className="w-3.5 h-3.5 text-celeste-500" />
                        <span>Juegos Evita Formosa</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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



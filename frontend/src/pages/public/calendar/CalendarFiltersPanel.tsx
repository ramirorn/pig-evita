// ===========================================
// CalendarFiltersPanel — panel de filtros del calendario público
// ===========================================
import { Filter, RotateCcw, Search, X } from 'lucide-react';
import type { Discipline } from '@/types';
import { Input } from '@/components/ui/input';
import { MONTH_NAMES } from './eventStageStyles';
import type { CalendarPageFilters } from './calendarFilters';

interface CalendarFiltersPanelProps {
  filters: CalendarPageFilters;
  /** Recibe sólo el campo que cambió; la página lo mergea sobre el estado. */
  onChange: (patch: Partial<CalendarPageFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  disciplines: Discipline[];
  /** Cantidad ya filtrada; el panel sólo la muestra, no la calcula. */
  resultCount: number;
}

export function CalendarFiltersPanel({
  filters,
  onChange,
  onReset,
  hasActiveFilters,
  disciplines,
  resultCount,
}: CalendarFiltersPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 shadow-sm mb-10">
      <div className="flex items-center gap-2 mb-4 text-primary-900 font-bold text-base">
        <Filter className="w-4 h-4 text-primary-600" />
        <span>Filtrar Cronograma</span>
        {hasActiveFilters && (
          <button
            onClick={onReset}
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
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="pl-9 h-10 text-sm rounded-xl border-primary-200 focus-visible:ring-primary-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selector de Mes */}
        <div>
          <select
            value={filters.month}
            onChange={(e) => onChange({ month: e.target.value })}
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
            value={filters.stage}
            onChange={(e) => onChange({ stage: e.target.value })}
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
            value={filters.disciplineId}
            onChange={(e) => onChange({ disciplineId: e.target.value })}
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
          Mostrando <strong className="text-primary-900">{resultCount}</strong> {resultCount === 1 ? 'evento encontrado' : 'eventos encontrados'}
        </span>
      </div>
    </div>
  );
}

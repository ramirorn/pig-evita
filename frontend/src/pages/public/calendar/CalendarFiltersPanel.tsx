// ===========================================
// CalendarFiltersPanel — barra de filtros del calendario público
// ===========================================
import { RotateCcw, Search, X } from 'lucide-react';
import type { Discipline } from '@/types';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import { STAGE_LABELS } from '@/lib/constants';
import { CompetitionStage } from '@/types';
import type { CalendarPageFilters, OpcionDeMes } from './calendarFilters';

interface CalendarFiltersPanelProps {
  filters: CalendarPageFilters;
  /** Recibe sólo el campo que cambió; la página lo mergea sobre el estado. */
  onChange: (patch: Partial<CalendarPageFilters>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  disciplines: Discipline[];
  /** Cantidad ya filtrada; el panel sólo la muestra, no la calcula. */
  resultCount: number;
  /**
   * Meses con eventos, ya resueltos por la página (`opcionesDeMes`). El panel
   * no arma la lista: los doce meses fijos no alcanzan desde que la clave
   * incluye el año (R31).
   */
  monthOptions: OpcionDeMes[];
}

/** Valor de "sin filtro" que la página ya usa en la URL para mes, etapa y disciplina. */
const TODOS = 'ALL';

const STAGE_OPTIONS = Object.values(CompetitionStage).map((stage) => ({
  value: stage,
  label: `Etapa ${STAGE_LABELS[stage]}`,
}));

/**
 * Una barra compacta: 1 columna en el celular, 2 en tablet y 4 en escritorio.
 * El contador y "Limpiar filtros" van afuera, debajo; el contador es
 * `role="status"` para que el lector anuncie el resultado al filtrar.
 */
export function CalendarFiltersPanel({
  filters,
  onChange,
  onReset,
  hasActiveFilters,
  disciplines,
  resultCount,
  monthOptions,
}: CalendarFiltersPanelProps) {
  return (
    <>
      <div
        role="search"
        aria-label="Filtrar eventos del calendario"
        className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-primary-100 bg-surface-elevated p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-500"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar evento…"
            aria-label="Buscar evento"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="h-11 w-full rounded-xl border-primary-200 bg-white pl-9 pr-10 text-sm font-medium text-primary-900 placeholder:text-muted-foreground sm:h-10"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ search: '' })}
              aria-label="Borrar búsqueda"
              className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-primary-500 hover:bg-primary-50 hover:text-primary-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <SelectField
          aria-label="Filtrar por mes"
          value={filters.month}
          onValueChange={(month) => onChange({ month })}
          options={[{ value: TODOS, label: 'Todos los meses' }, ...monthOptions]}
        />

        <SelectField
          aria-label="Filtrar por etapa"
          value={filters.stage}
          onValueChange={(stage) => onChange({ stage })}
          options={[{ value: TODOS, label: 'Todas las etapas' }, ...STAGE_OPTIONS]}
        />

        <SelectField
          aria-label="Filtrar por disciplina"
          value={filters.disciplineId}
          onValueChange={(disciplineId) => onChange({ disciplineId })}
          options={[
            { value: TODOS, label: 'Todas las disciplinas' },
            ...disciplines.map((disc) => ({ value: disc.id, label: disc.name })),
          ]}
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-2 px-1">
        <p role="status" className="text-xs text-primary-600">
          Mostrando <strong className="font-semibold text-primary-900">{resultCount}</strong>{' '}
          {resultCount === 1 ? 'evento encontrado' : 'eventos encontrados'}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Limpiar filtros
          </button>
        )}
      </div>
    </>
  );
}

// ===========================================
// ReportFiltersPanel — barra de filtros global de la exportación
// ===========================================
import { Filter, RotateCcw } from 'lucide-react';
import type { Category, Discipline } from '@/types';
import { hasActiveReportFilters, type ReportFilters } from './reportFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportFiltersPanelProps {
  filters: ReportFilters;
  /** Recibe sólo los campos que cambiaron; la página los mergea sobre el estado. */
  onChange: (patch: Partial<ReportFilters>) => void;
  onReset: () => void;
  /**
   * Las listas llegan por props y no de un hook propio: la página ya consulta
   * las categorías filtradas por la disciplina elegida acá.
   */
  disciplines: Discipline[];
  categories: Category[];
  /**
   * R05 — el reporte sale recortado al alcance territorial del usuario y lo
   * declara en su primera fila. Para un rol acotado, este filtro no puede
   * ampliar nada: pedir otro departamento devuelve un archivo vacío.
   */
  mostrarFiltroDepartamento: boolean;
}

export function ReportFiltersPanel({
  filters,
  onChange,
  onReset,
  disciplines,
  categories,
  mostrarFiltroDepartamento,
}: ReportFiltersPanelProps) {
  const hasActiveFilters = hasActiveReportFilters(filters);

  return (
    <div className="card p-5 space-y-4 bg-white border border-primary-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-primary-100 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-sm text-primary-900">
            Filtros para Exportación
          </h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-800">
              Filtros activos
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-primary-500 hover:text-primary-800 gap-1 h-8 px-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-primary-700">Disciplina</label>
          <Select
            value={filters.disciplineId}
            // Cambiar de disciplina invalida la categoría elegida: las
            // categorías dependen de la disciplina.
            onValueChange={(v) => onChange({ disciplineId: v, categoryId: 'all' })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder="Todas las disciplinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las disciplinas</SelectItem>
              {disciplines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-primary-700">Categoría</label>
          <Select
            value={filters.categoryId}
            onValueChange={(v) => onChange({ categoryId: v })}
            disabled={filters.disciplineId === 'all'}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mostrarFiltroDepartamento && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary-700">Departamento</label>
            <Input
              placeholder="Ej. Formosa, Pilcomayo..."
              value={filters.department}
              onChange={(e) => onChange({ department: e.target.value })}
              className="bg-white"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-primary-700">Localidad</label>
          <Input
            placeholder="Ej. Clorinda, Pirané..."
            value={filters.locality}
            onChange={(e) => onChange({ locality: e.target.value })}
            className="bg-white"
          />
        </div>
      </div>
    </div>
  );
}

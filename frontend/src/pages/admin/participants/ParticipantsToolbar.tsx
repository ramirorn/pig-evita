// ===========================================
// ParticipantsToolbar — filtros del padrón de participantes
// ===========================================
import { Search } from 'lucide-react';
import type { Category, Discipline } from '@/types';
import type { ParticipantListFilters } from './participantFilters';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ParticipantsToolbarProps {
  filters: ParticipantListFilters;
  /** Recibe sólo los campos que cambiaron; la página los mergea sobre el estado. */
  onChange: (patch: Partial<ParticipantListFilters>) => void;
  /**
   * Las listas llegan por props y no de un hook propio: la página ya consulta
   * las categorías filtradas por la disciplina elegida acá.
   */
  disciplines: Discipline[];
  categories: Category[];
}

export function ParticipantsToolbar({
  filters,
  onChange,
  disciplines,
  categories,
}: ParticipantsToolbarProps) {
  return (
    <>
      <div className="relative flex-1 min-w-[200px]">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
          aria-hidden="true"
        />
        <Input
          placeholder="Buscar por DNI o Apellido..."
          aria-label="Buscar participantes"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.disciplineId}
        // Cambiar de disciplina invalida la categoría elegida: las categorías
        // dependen de la disciplina.
        onValueChange={(v) => onChange({ disciplineId: v, categoryId: 'all' })}
      >
        <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por disciplina">
          <SelectValue placeholder="Disciplina" />
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

      <Select
        value={filters.categoryId}
        onValueChange={(v) => onChange({ categoryId: v })}
        disabled={filters.disciplineId === 'all'}
      >
        <SelectTrigger className="w-full md:w-[200px]" aria-label="Filtrar por categoría">
          <SelectValue placeholder="Categoría" />
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

      <Input
        placeholder="Departamento..."
        aria-label="Filtrar por departamento"
        value={filters.department}
        onChange={(e) => onChange({ department: e.target.value })}
        className="w-full md:w-[180px]"
      />

      <Input
        placeholder="Localidad..."
        aria-label="Filtrar por localidad"
        value={filters.locality}
        onChange={(e) => onChange({ locality: e.target.value })}
        className="w-full md:w-[180px]"
      />
    </>
  );
}

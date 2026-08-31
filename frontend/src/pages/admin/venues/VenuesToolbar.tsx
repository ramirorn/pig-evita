// ===========================================
// VenuesToolbar — filtros del listado de sedes
// ===========================================
import { Search } from 'lucide-react';
import type { VenueListFilters } from './venueFilters';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FORMOSA_DEPARTMENTS = [
  'Formosa',
  'Pilcomayo',
  'Pirané',
  'Patiño',
  'Pilagás',
  'Bermejo',
  'Matacos',
  'Ramón Lista',
  'Laishí',
];

interface VenuesToolbarProps {
  filters: VenueListFilters;
  /** Recibe sólo el campo que cambió; la página lo mergea sobre el estado. */
  onChange: (patch: Partial<VenueListFilters>) => void;
}

export function VenuesToolbar({ filters, onChange }: VenuesToolbarProps) {
  return (
    <>
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
          aria-hidden="true"
        />
        {/*
          S06 — el placeholder prometía dirección y localidad porque el filtrado
          era local sobre la página traída. Ahora busca el backend
          (`VenueFilterDto` → `search`), que compara contra el nombre: el texto
          dice lo que la búsqueda hace, y alcanza a todas las sedes, no a 20.
        */}
        <Input
          placeholder="Buscar por nombre de sede..."
          aria-label="Buscar sedes"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="pl-9 bg-white"
        />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <Select value={filters.department} onValueChange={(val) => onChange({ department: val })}>
          <SelectTrigger
            className="w-full sm:w-[180px] bg-white"
            aria-label="Filtrar por departamento"
          >
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {FORMOSA_DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(val) => onChange({ status: val as VenueListFilters['status'] })}
        >
          <SelectTrigger
            className="w-full sm:w-[140px] bg-white"
            aria-label="Filtrar por estado"
          >
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

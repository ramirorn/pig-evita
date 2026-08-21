// ===========================================
// venueFilters — modelo de filtros del listado de sedes
// ===========================================
import type { Venue } from '@/types';

/**
 * Los tres filtros viajan como un solo objeto en vez de seis props sueltas
 * (valor + setter por cada uno): la página los guarda junto y el "limpiar
 * filtros" del `DataTable` los resetea de una.
 */
export interface VenueListFilters {
  search: string;
  department: string;
  status: 'all' | 'active' | 'inactive';
}

export const EMPTY_VENUE_FILTERS: VenueListFilters = {
  search: '',
  department: 'all',
  status: 'all',
};

export function hasActiveVenueFilters(filters: VenueListFilters): boolean {
  return filters.search.trim() !== '' || filters.department !== 'all' || filters.status !== 'all';
}

/** El backend devuelve el listado completo de sedes: el filtrado es local. */
export function filterVenues(venues: Venue[], filters: VenueListFilters): Venue[] {
  return venues.filter((v) => {
    const needle = filters.search.toLowerCase();
    const matchesSearch =
      v.name.toLowerCase().includes(needle) ||
      v.locality.toLowerCase().includes(needle) ||
      v.department.toLowerCase().includes(needle) ||
      (v.address ?? '').toLowerCase().includes(needle);

    const matchesDept =
      filters.department === 'all' ||
      v.department.toLowerCase() === filters.department.toLowerCase();

    const matchesStatus =
      filters.status === 'all' || (filters.status === 'active' ? v.isActive : !v.isActive);

    return matchesSearch && matchesDept && matchesStatus;
  });
}

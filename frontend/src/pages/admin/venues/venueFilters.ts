// ===========================================
// venueFilters — modelo de filtros del listado de sedes
// ===========================================
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

/**
 * Traduce el estado de la UI al query que espera el backend, que es quien
 * filtra (S06): `'all'` y el texto vacío se mandan como `undefined` para no
 * agregar el parámetro a la URL.
 *
 * Antes el filtrado era local sobre `venuesData.data`, que son las primeras 20
 * sedes —el default de `pagination.dto.ts`—, no "el listado completo" como
 * decía el comentario que estaba acá. Con 25 sedes, la 23 no aparecía nunca.
 */
export function toVenueQuery(filters: VenueListFilters) {
  return {
    search: filters.search.trim() || undefined,
    department: filters.department !== 'all' ? filters.department : undefined,
    isActive: filters.status === 'all' ? undefined : filters.status === 'active',
  };
}

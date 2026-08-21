// ===========================================
// participantFilters — modelo de filtros del padrón de participantes
// ===========================================

/**
 * Los cinco filtros viajan como un solo objeto en vez de diez props sueltas
 * (valor + setter por cada uno): la página los guarda junto y el "limpiar
 * filtros" del `DataTable` los resetea de una.
 *
 * `page` y `limit` quedan afuera a propósito: no son criterios de búsqueda sino
 * la posición dentro del resultado, y el `DataTable` ya los maneja aparte.
 */
export interface ParticipantListFilters {
  search: string;
  department: string;
  locality: string;
  disciplineId: string;
  categoryId: string;
}

export const EMPTY_PARTICIPANT_FILTERS: ParticipantListFilters = {
  search: '',
  department: '',
  locality: '',
  disciplineId: 'all',
  categoryId: 'all',
};

export function hasActiveParticipantFilters(filters: ParticipantListFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.department.trim() !== '' ||
    filters.locality.trim() !== '' ||
    filters.disciplineId !== 'all' ||
    filters.categoryId !== 'all'
  );
}

/**
 * Traduce el estado de la UI al query que espera el backend, que es quien
 * filtra: `'all'` y los textos vacíos se mandan como `undefined` para no
 * agregar el parámetro a la URL.
 */
export function toParticipantQuery(filters: ParticipantListFilters) {
  return {
    search: filters.search || undefined,
    department: filters.department || undefined,
    locality: filters.locality || undefined,
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
    categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
  };
}

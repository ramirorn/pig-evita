// ===========================================
// teamFilters — modelo de filtros del listado de equipos
// ===========================================

/**
 * Los cuatro filtros viajan como un solo objeto en vez de ocho props sueltas
 * (valor + setter por cada uno): la página los guarda junto y el "limpiar
 * filtros" del `DataTable` los resetea de una.
 *
 * `page` y `limit` quedan afuera a propósito: no son criterios de búsqueda sino
 * la posición dentro del resultado, y el `DataTable` ya los maneja aparte.
 */
export interface TeamListFilters {
  department: string;
  locality: string;
  disciplineId: string;
  categoryId: string;
}

export const EMPTY_TEAM_FILTERS: TeamListFilters = {
  department: '',
  locality: '',
  disciplineId: 'all',
  categoryId: 'all',
};

export function hasActiveTeamFilters(filters: TeamListFilters): boolean {
  return (
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
export function toTeamQuery(filters: TeamListFilters) {
  return {
    department: filters.department || undefined,
    locality: filters.locality || undefined,
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
    categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
  };
}

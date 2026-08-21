// ===========================================
// reportFilters — modelo de filtros de la exportación de reportes
// ===========================================

/**
 * Los cuatro filtros viajan como un solo objeto en vez de ocho props sueltas
 * (valor + setter por cada uno): son un único criterio que se aplica a la
 * exportación, y el "limpiar filtros" los resetea de una.
 */
export interface ReportFilters {
  disciplineId: string;
  categoryId: string;
  department: string;
  locality: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  disciplineId: 'all',
  categoryId: 'all',
  department: '',
  locality: '',
};

export function hasActiveReportFilters(filters: ReportFilters): boolean {
  return (
    filters.disciplineId !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.department.trim() !== '' ||
    filters.locality.trim() !== ''
  );
}

/**
 * Traduce el estado de la UI al query de la API de reportes: `'all'` y los
 * textos vacíos se mandan como `undefined` para no agregar el parámetro.
 */
export function toReportQuery(filters: ReportFilters) {
  return {
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
    categoryId: filters.categoryId !== 'all' ? filters.categoryId : undefined,
    department: filters.department.trim() || undefined,
    locality: filters.locality.trim() || undefined,
  };
}

// ===========================================
// calendarFilters — modelo de filtros del calendario público
// ===========================================
import type { CalendarEvent } from '@/types';

/**
 * Los cuatro filtros viajan como un solo objeto en vez de ocho props sueltas
 * (valor + setter por cada uno), igual que en los listados de admin: así el
 * panel recibe `filters` + un `onChange` parcial y el "limpiar filtros"
 * resetea todo de una.
 */
export interface CalendarPageFilters {
  search: string;
  /** Índice de mes como string ('0'..'11') o 'ALL'; sale del `<select>`. */
  month: string;
  stage: string;
  disciplineId: string;
}

export const EMPTY_CALENDAR_FILTERS: CalendarPageFilters = {
  search: '',
  month: 'ALL',
  stage: 'ALL',
  disciplineId: 'ALL',
};

export function hasActiveCalendarFilters(filters: CalendarPageFilters): boolean {
  return (
    filters.search !== '' ||
    filters.stage !== 'ALL' ||
    filters.month !== 'ALL' ||
    filters.disciplineId !== 'ALL'
  );
}

/** El backend devuelve hasta 100 eventos publicados: el filtrado es local. */
export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarPageFilters,
): CalendarEvent[] {
  const needle = filters.search.toLowerCase();

  return events.filter((event) => {
    const eventMonth = new Date(event.startDate).getMonth().toString();

    const matchesSearch =
      filters.search === '' ||
      event.title.toLowerCase().includes(needle) ||
      (!!event.description && event.description.toLowerCase().includes(needle));

    const matchesStage = filters.stage === 'ALL' || event.stage === filters.stage;
    const matchesMonth = filters.month === 'ALL' || eventMonth === filters.month;
    const matchesDiscipline =
      filters.disciplineId === 'ALL' || event.disciplineId === filters.disciplineId;

    return matchesSearch && matchesStage && matchesMonth && matchesDiscipline;
  });
}

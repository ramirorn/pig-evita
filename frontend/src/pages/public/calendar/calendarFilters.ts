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
  /**
   * Mes **con año**, como `'2026-03'`, o `'ALL'`; sale del `<select>`.
   *
   * Antes viajaba el índice de mes suelto (`'0'..'11'`) y el filtro comparaba
   * con `getMonth()` sin mirar el año: elegir "Marzo" mostraba juntos los
   * eventos de marzo de 2025 y los de marzo de 2026, que en un calendario
   * deportivo con etapas anuales es directamente un dato equivocado (R31).
   */
  month: string;
  stage: string;
  disciplineId: string;
}

/** Clave `YYYY-MM` de una fecha ISO, en hora local (igual que la mostrada). */
export function claveDeMes(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/** Una opción del selector de mes: la clave que viaja y la etiqueta visible. */
export interface OpcionDeMes {
  value: string;
  label: string;
}

/**
 * Los meses que **de verdad** tienen eventos, en orden cronológico.
 *
 * Se derivan del conjunto traído en vez de listar los doce meses fijos: con el
 * año en juego, "Marzo" a secas ya no identifica nada, y ofrecer "Marzo 2025"
 * cuando no hay ningún evento en marzo de 2025 es una opción que sólo puede
 * terminar en una lista vacía.
 */
export function opcionesDeMes(events: CalendarEvent[], nombresDeMes: string[]): OpcionDeMes[] {
  const claves = new Set(events.map((event) => claveDeMes(event.startDate)));

  return [...claves]
    .sort()
    .map((value) => {
      const [anio, mes] = value.split('-');
      // `noUncheckedIndexedAccess`: el split de una clave que armamos nosotros
      // siempre da dos partes, pero el tipo no lo sabe.
      const nombre = nombresDeMes[Number(mes) - 1] ?? mes;
      return { value, label: `${nombre} ${anio}` };
    });
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

/**
 * Filtrado local sobre el conjunto **completo** de eventos publicados.
 *
 * Antes esto corría sobre los primeros 100 que devolvía el backend y nadie lo
 * decía; ahora la página los trae todos con `useAllCalendarEvents` (R29), así
 * que filtrar en memoria vuelve a ser legítimo.
 */
export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarPageFilters,
): CalendarEvent[] {
  const needle = filters.search.toLowerCase();

  return events.filter((event) => {
    const eventMonth = claveDeMes(event.startDate);

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

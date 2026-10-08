// ===========================================
// Próximos eventos del calendario, para el panel de /noticias
// ===========================================
import type { CalendarEvent } from '@/types';
import { repartirPorFecha } from '../calendar/calendarSecciones';

/** Cuántos eventos lista el panel: los mismos 5 renglones del diseño. */
export const EVENTOS_EN_PANEL = 5;

/**
 * Los próximos eventos **publicados** del calendario, del más cercano al más
 * lejano.
 *
 * Reusa el corte de `CalendarPage` (`repartirPorFecha`) en vez de comparar
 * fechas acá: "próximo" significa lo mismo en las dos pantallas —un evento de
 * varios días que ya arrancó sigue siendo próximo hasta que termina—. El filtro
 * de publicados se repite aunque la página ya los pida así: el panel no debe
 * poder mostrar un borrador si alguien le pasa la lista completa.
 *
 * `ahora` se recibe por parámetro para que el chequeo lo ejercite con una
 * fecha fija.
 */
export function proximosEventos(
  eventos: readonly CalendarEvent[],
  ahora: Date = new Date(),
  cantidad: number = EVENTOS_EN_PANEL,
): CalendarEvent[] {
  const publicados = eventos.filter((e) => e.isPublished);
  return repartirPorFecha(publicados, ahora).proximos.slice(0, cantidad);
}

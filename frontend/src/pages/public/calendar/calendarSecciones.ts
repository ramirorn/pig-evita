// ===========================================
// calendarSecciones — el corte entre lo que viene y lo que ya pasó
// ===========================================
import type { CalendarEvent } from '@/types';

/**
 * Vive aparte de `CalendarPage.tsx` por la misma razón que `newsLayout.ts`: un
 * módulo que exporta componentes **y** funciones sueltas rompe el fast refresh
 * de Vite y el lint del proyecto lo marca. Además así el corte se ejercita sin
 * montar la página.
 *
 * ⚠️ No toca `calendarFilters.ts` ni `eventStageStyles.ts`, que cargan las
 * correcciones de R29, R31 y S06 y están bien resueltos.
 */

export interface SeccionesDelCalendario {
  /** De hoy en adelante, del más próximo al más lejano. */
  proximos: CalendarEvent[];
  /** Ya se disputaron, del más reciente al más viejo. */
  pasados: CalendarEvent[];
}

/** ¿Las dos fechas caen el mismo día del calendario local? */
export function esMismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Medianoche local de la fecha dada. El corte es por día, no por hora. */
function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/**
 * Parte la lista ya filtrada en "próximos" y "ya se disputaron".
 *
 * Hoy la página los muestra mezclados, sin orden explícito ni corte: con los
 * tres eventos cargados hay uno del 26/08 que ya pasó, uno del 31/08 que es hoy
 * y uno del 10/09, y los tres se ven idénticos. `startDate` es dato real y
 * alcanza para separarlos.
 *
 * El corte es **por día y no por instante**: un evento que empezó esta mañana
 * sigue siendo "de hoy" a la tarde, no algo que ya se disputó. Por eso se
 * compara contra la medianoche local y no contra `Date.now()`.
 *
 * `ahora` se recibe por parámetro en vez de leerse adentro para que la función
 * sea determinista y se pueda ejercitar con una fecha fija.
 */
export function repartirPorFecha(
  eventos: CalendarEvent[],
  ahora: Date = new Date(),
): SeccionesDelCalendario {
  const corte = inicioDelDia(ahora);

  const proximos: CalendarEvent[] = [];
  const pasados: CalendarEvent[] = [];

  for (const evento of eventos) {
    const inicio = new Date(evento.startDate);

    // Una fecha ilegible no se descarta en silencio: va a "próximos", que es
    // donde alguien la va a ver y notar. Esconderla sería perder el evento.
    if (Number.isNaN(inicio.getTime())) {
      proximos.push(evento);
      continue;
    }

    // El día de cierre del evento manda: uno que arrancó ayer y termina mañana
    // todavía está en curso, no se disputó.
    const cierre = evento.endDate ? new Date(evento.endDate) : inicio;
    const referencia = Number.isNaN(cierre.getTime()) ? inicio : cierre;

    if (inicioDelDia(referencia) >= corte) proximos.push(evento);
    else pasados.push(evento);
  }

  const porInicio = (e: CalendarEvent) => new Date(e.startDate).getTime();

  proximos.sort((a, b) => porInicio(a) - porInicio(b));
  pasados.sort((a, b) => porInicio(b) - porInicio(a));

  return { proximos, pasados };
}

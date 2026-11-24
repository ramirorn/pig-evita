// ===========================================
// Rango de fechas de los filtros (F-18)
// ===========================================

/** `YYYY-MM-DD` sin hora: un día de calendario, no un instante. */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Límite inferior de un filtro `fromDate`. `new Date('2026-12-01')` ya es el
 * comienzo de ese día en UTC, así que no hace falta tocarlo; existe para que
 * los dos extremos se lean igual en los services.
 */
export function inicioDelRango(valor: string): Date {
  return new Date(valor);
}

/**
 * Límite superior de un filtro `toDate`.
 *
 * Con sólo la fecha (`toDate=2026-12-01`), `new Date()` devuelve las 00:00 UTC
 * de ese día y el `lte` excluía todo lo que pasaba durante el día pedido: un
 * filtro "del 1 al 1" no traía nada. Una fecha sin hora se interpreta como el
 * día completo (hasta las 23:59:59.999 UTC). Una marca de tiempo completa se
 * respeta tal cual: quien manda la hora la eligió.
 */
export function finDelRango(valor: string): Date {
  return SOLO_FECHA.test(valor)
    ? new Date(`${valor}T23:59:59.999Z`)
    : new Date(valor);
}

// ===========================================
// KPIs
// ===========================================
import type { KpiResultado } from '@/types';

// ===========================================
// KPIs
// ===========================================

/** Texto grande de la tarjeta: "60 %", "12", o "—" si no se puede publicar. */
export function formatearKpi(kpi: KpiResultado): string {
  if (kpi.valor === null) return '—';
  return kpi.formato === 'porcentaje'
    ? `${kpi.valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
    : kpi.valor.toLocaleString('es-AR');
}

/** Por qué una tarjeta muestra "—". `null` cuando el valor se publica. */
export function motivoKpiOculto(kpi: KpiResultado, umbral: number): string | null {
  if (kpi.valor !== null) return null;
  if (kpi.numerador.suprimido || kpi.denominador.suprimido) {
    return `Menos de ${umbral} respuestas en este corte: no se publica para proteger el anonimato.`;
  }
  return 'Todavía no hay respuestas que cumplan la condición base.';
}

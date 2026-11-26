// ===========================================
// Período (Día / Semana / Todo) y mini tendencia
// ===========================================
import type { MetricsFiltros } from '@/types';
import { ZONA_HORARIA } from './plainLanguage';

// ===========================================
// Período (Día / Semana / Todo)
// ===========================================

export type Periodo = 'dia' | 'semana' | 'todo';

export const ETIQUETAS_PERIODO: Record<Periodo, string> = {
  dia: 'Hoy',
  semana: 'Últimos 7 días',
  todo: 'Todo',
};

/** `YYYY-MM-DD` de hoy en Formosa (los filtros de fecha del backend van en ese huso). */
export function hoyEnFormosa(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/** Resta días a una fecha `YYYY-MM-DD` sin pasar por husos horarios. */
function restarDias(fecha: string, dias: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia - dias));
  return utc.toISOString().slice(0, 10);
}

export function rangoDePeriodo(
  periodo: Periodo,
  hoy: string,
): { desde: string | undefined; hasta: string | undefined } {
  switch (periodo) {
    case 'dia':
      return { desde: hoy, hasta: hoy };
    case 'semana':
      return { desde: restarDias(hoy, 6), hasta: hoy };
    case 'todo':
      return { desde: undefined, hasta: undefined };
  }
}

/** Qué botón del selector corresponde a los filtros; un rango a mano no marca ninguno. */
export function periodoActivo(
  filtros: Pick<MetricsFiltros, 'desde' | 'hasta'>,
  hoy: string,
): Periodo | 'personalizado' {
  if (!filtros.desde && !filtros.hasta) return 'todo';
  for (const periodo of ['dia', 'semana'] as const) {
    const rango = rangoDePeriodo(periodo, hoy);
    if (rango.desde === filtros.desde && rango.hasta === filtros.hasta) return periodo;
  }
  return 'personalizado';
}

// ===========================================
// Mini tendencia (sparkline)
// ===========================================

/**
 * Puntos de un `<polyline>` de `ancho`×`alto` px. Los valores suprimidos
 * (`null`) se saltean: la línea une sólo los publicados, sin inventar ceros.
 */
export function puntosSparkline(
  valores: readonly (number | null)[],
  ancho: number,
  alto: number,
): string {
  const publicados = valores.filter((v): v is number => v !== null);
  if (publicados.length === 0) return '';
  const redondear = (n: number) => Number(n.toFixed(1));
  if (publicados.length === 1) return `0,${alto / 2} ${ancho},${alto / 2}`;
  const min = Math.min(...publicados);
  const max = Math.max(...publicados);
  const rango = max - min || 1;
  return publicados
    .map((v, i) => {
      const x = (i / (publicados.length - 1)) * ancho;
      const y = max === min ? alto / 2 : alto - ((v - min) / rango) * alto;
      return `${redondear(x)},${redondear(y)}`;
    })
    .join(' ');
}

// ===========================================
// PeriodSwitch — Hoy / Últimos 7 días / Todo
// ===========================================
//
// Atajo para el rango de fechas: escribe `desde` y `hasta` en los mismos
// filtros que usa la barra de filtros (y la URL). Si el rango se eligió a
// mano en el calendario, ningún botón queda marcado.
import type { MetricsFiltros } from '@/types';
import { cn } from '@/lib/utils';
import {
  ETIQUETAS_PERIODO,
  hoyEnFormosa,
  periodoActivo,
  puedeSumarFiltro,
  rangoDePeriodo,
  TEXTO_TOPE_FILTROS,
  type Periodo,
} from '@/lib/metrics/metricsRules';

const PERIODOS: Periodo[] = ['dia', 'semana', 'todo'];

interface PeriodSwitchProps {
  filtros: MetricsFiltros;
  onChange: (filtros: MetricsFiltros) => void;
}

export function PeriodSwitch({ filtros, onChange }: PeriodSwitchProps) {
  const hoy = hoyEnFormosa();
  const activo = periodoActivo(filtros, hoy);
  // "Hoy" y "7 días" suman un filtro de fecha: con el tope alcanzado no se
  // pueden elegir. "Todo" quita el filtro, así que siempre se puede.
  const sinLugar = !puedeSumarFiltro(filtros, 'fecha');

  return (
    <div
      role="radiogroup"
      aria-label="Período"
      className="inline-flex rounded-full border border-primary-200 bg-white p-1"
    >
      {PERIODOS.map((periodo) => {
        const elegido = activo === periodo;
        const deshabilitado = sinLugar && periodo !== 'todo';
        return (
          <button
            key={periodo}
            type="button"
            role="radio"
            aria-checked={elegido}
            disabled={deshabilitado}
            title={deshabilitado ? TEXTO_TOPE_FILTROS : undefined}
            onClick={() => onChange({ ...filtros, ...rangoDePeriodo(periodo, hoy) })}
            className={cn(
              'min-h-9 rounded-full px-4 text-sm font-semibold transition-colors duration-120',
              elegido ? 'bg-primary-700 text-white shadow-sm' : 'text-primary-700 hover:bg-primary-50',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {ETIQUETAS_PERIODO[periodo]}
          </button>
        );
      })}
    </div>
  );
}

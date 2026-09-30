// ===========================================
// MapLegend — qué significan los tonos y los tamaños
// ===========================================
import {
  BUBBLE_COLOR,
  bubbleRadius,
  metricInfo,
  NO_DATA_COLOR,
  NO_DATA_HATCH,
  type HeatClass,
  type MapMetric,
} from '@/lib/localityMap';
import { cn } from '@/lib/utils';

interface MapLegendProps {
  classes: readonly HeatClass[];
  metric: MapMetric;
  /** Valores reales de referencia para los tamaños (el primero es el máximo). */
  bubbleValues: readonly number[];
  /**
   * `overlay`: recuadro semitransparente en la esquina vacía del mapa
   * (tablet y escritorio). `row`: fila compacta debajo del mapa (celular).
   */
  layout: 'overlay' | 'row';
  className?: string;
}

/** Muestra de "sin participación": el mismo rayado que el mapa. */
function MuestraSinDatos() {
  return (
    <svg width="18" height="12" aria-hidden="true" className="shrink-0 rounded-[3px] ring-1 ring-slate-300">
      <rect width="18" height="12" style={{ fill: NO_DATA_COLOR }} />
      {[-8, -3, 2, 7, 12, 17].map((x) => (
        <line key={x} x1={x} y1="12" x2={x + 12} y2="0" strokeWidth="1.5" style={{ stroke: NO_DATA_HATCH }} />
      ))}
    </svg>
  );
}

/**
 * Leyenda compacta: tonos (departamentos) y tamaños (localidades). Los círculos
 * de referencia usan la misma función de radio que el mapa, a escala, y sólo
 * valores que existen en los datos.
 */
export function MapLegend({ classes, metric, bubbleValues, layout, className }: MapLegendProps) {
  const info = metricInfo(metric);
  const maximo = bubbleValues[0] ?? 0;
  // El mapa se ve a ~0,65 px por unidad en escritorio: la leyenda usa la misma escala.
  const escala = 0.65;
  const rMax = bubbleRadius(maximo, maximo) * escala;
  const esFila = layout === 'row';

  return (
    <section
      aria-label="Referencias del mapa"
      className={cn(
        'text-[11px] leading-tight text-primary-700',
        esFila
          ? 'flex flex-wrap items-start gap-x-5 gap-y-2 rounded-xl border border-primary-100 bg-white px-3 py-2'
          : 'w-40 rounded-xl border border-primary-100/80 bg-white/85 p-2 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <div>
        <p className="font-semibold uppercase tracking-wide text-primary-500">{info.label} por depto.</p>
        <ul className={cn('mt-1', esFila ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-0.5')}>
          {[...classes].reverse().map((c) => (
            <li key={c.from} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-[18px] shrink-0 rounded-[3px] ring-1 ring-black/10"
                style={{ backgroundColor: c.color }}
              />
              {c.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <MuestraSinDatos />
            Sin participación
          </li>
        </ul>
      </div>

      {bubbleValues.length > 0 && (
        <div className={esFila ? undefined : 'mt-2 border-t border-primary-100 pt-2'}>
          <p className="font-semibold uppercase tracking-wide text-primary-500">{info.label} por localidad</p>
          <div
            className="mt-1 flex items-end gap-3"
            role="img"
            aria-label={`Círculos de referencia: ${bubbleValues.map((v) => v.toLocaleString('es-AR')).join(', ')} ${info.plural}`}
          >
            {bubbleValues.map((v) => {
              const r = bubbleRadius(v, maximo) * escala;
              return (
                <div key={v} className="flex flex-col items-center gap-0.5">
                  <svg width={rMax * 2 + 4} height={rMax * 2 + 4} aria-hidden="true">
                    <circle
                      cx={rMax + 2}
                      cy={rMax * 2 + 2 - r}
                      r={r}
                      stroke="white"
                      strokeWidth={1.5}
                      style={{ fill: BUBBLE_COLOR }}
                    />
                  </svg>
                  <span>{v.toLocaleString('es-AR')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

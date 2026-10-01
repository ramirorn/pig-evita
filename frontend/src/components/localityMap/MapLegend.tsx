// ===========================================
// MapLegend — la escala del calor, debajo del mapa
// ===========================================
import {
  formatMetric,
  HEAT_GRADIENT_CSS,
  heatValueRange,
  metricInfo,
  PROVINCE_FILL,
  themeColor,
  type HeatPoint,
  type MapMetric,
} from '@/lib/localityMap';
import { cn } from '@/lib/utils';

interface MapLegendProps {
  metric: MapMetric;
  /** Las localidades con calor (para el mínimo y el máximo reales). */
  points: readonly HeatPoint[];
  /** Hay localidades ubicadas sin participación en la métrica. */
  hasZeros: boolean;
  /** Barra más corta (pie de pantalla completa en el celular). */
  compact?: boolean;
}

/**
 * Leyenda en una fila de pie, **debajo** del mapa: superpuesta tapaba la
 * provincia. Muestra el mínimo y el máximo reales (con su unidad) a los lados de
 * la barra del gradiente, sin marcas intermedias para no inventar valores.
 *
 * Casos: un solo valor → "Cada mancha: N atletas" con la muestra amarilla;
 * todo en cero → sólo el aviso.
 */
export function MapLegend({ metric, points, hasZeros, compact = false }: MapLegendProps) {
  const info = metricInfo(metric);
  const rango = heatValueRange(points);
  const titulo = `Concentración de ${info.plural}`;

  if (!rango) {
    return (
      <p className="text-xs font-semibold text-primary-800">
        Sin participación registrada en esta métrica
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-1" aria-label="Escala del mapa de calor" role="group">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-semibold text-primary-800">{titulo}</span>
        {rango.min === rango.max ? (
          <span className="inline-flex items-center gap-1.5 text-primary-700">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-4 rounded-sm ring-1 ring-primary-900/20"
              style={{ backgroundColor: themeColor('heat-yellow') }}
            />
            Cada mancha: {formatMetric(rango.max, metric)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-primary-700">
            {hasZeros && (
              <span className="mr-1 inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: themeColor(PROVINCE_FILL) }}
                />
                Sin participación
              </span>
            )}
            <span>{formatMetric(rango.min, metric)}</span>
            <span
              aria-hidden="true"
              className={cn('inline-block h-2 rounded-full ring-1 ring-primary-900/20', compact ? 'w-[120px]' : 'w-40')}
              style={{ backgroundImage: HEAT_GRADIENT_CSS }}
            />
            <span>{formatMetric(rango.max, metric)}</span>
          </span>
        )}
      </div>
      {!compact && (
        <p className="text-[11px] text-primary-500">
          Cada mancha brilla según su propia localidad: los pueblos cercanos no suman su calor.
        </p>
      )}
    </div>
  );
}

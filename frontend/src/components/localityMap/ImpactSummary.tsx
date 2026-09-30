// ===========================================
// ImpactSummary — KPIs, Top 5 y ranking por departamento
// ===========================================
import type { ReactNode } from 'react';
import { MapPin, Medal, Users, UsersRound } from 'lucide-react';
import {
  formatMetric,
  heatColor,
  metricInfo,
  metricValue,
  NO_DATA_COLOR,
  type HeatClass,
  type LocalityFigures,
  type LocalityRow,
  type MapMetric,
  type ProvinceTotals,
} from '@/lib/localityMap';
import { GEO_DEPARTMENTS } from '@/lib/geo/formosa.generated';

/**
 * Misma familia que las tarjetas de cifras de la home (`StatsSection`): vidrio
 * blanco con sombra azulada, ícono en bg-primary-50 que se vuelve dorado al
 * pasar el mouse, número en tipografía display y etiqueta en versalitas.
 */
function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="group flex h-16 items-center gap-3 rounded-2xl border border-white/50 bg-white/90 px-4 shadow-[0_20px_40px_-15px_rgba(0,45,108,0.15)] backdrop-blur-xl">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-800 transition-colors duration-300 group-hover:bg-accent-500 group-hover:text-primary-900">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-black leading-none text-primary-800">{value.toLocaleString('es-AR')}</p>
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-primary-600 sm:text-[11px] sm:tracking-widest">{label}</p>
      </div>
    </div>
  );
}

/** Los cuatro números de la provincia: 2 × 2 en el celular, en fila desde tablet. */
export function ProvinceTotalsBar({ totals }: { totals: ProvinceTotals }) {
  return (
    <section aria-label="Totales de la provincia" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi icon={<Users className="h-5 w-5" aria-hidden="true" />} label="Atletas" value={totals.athletes} />
      <Kpi icon={<UsersRound className="h-5 w-5" aria-hidden="true" />} label="Delegaciones" value={totals.delegations} />
      <Kpi icon={<MapPin className="h-5 w-5" aria-hidden="true" />} label="Localidades" value={totals.localities} />
      <Kpi icon={<Medal className="h-5 w-5" aria-hidden="true" />} label="Podios" value={totals.podiums} />
    </section>
  );
}

interface TopLocalitiesProps {
  rows: readonly LocalityRow[];
  metric: MapMetric;
  /** Abre el detalle de una localidad del mapa (las sin ubicación no tienen). */
  onSelect: (key: string, trigger: Element) => void;
}

/** Top 5 de localidades en la métrica elegida. Sin marco: vive dentro del panel. */
export function TopLocalities({ rows, metric, onSelect }: TopLocalitiesProps) {
  const info = metricInfo(metric);
  const max = rows[0] ? metricValue(rows[0].figures, metric) : 0;

  return (
    <section aria-labelledby="top-localidades">
      <h2 id="top-localidades" className="text-base font-bold text-primary-800">
        Top 5 localidades
      </h2>
      <p className="text-xs text-primary-500">Por cantidad de {info.plural}. Tocá una para ver el detalle.</p>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-primary-600">Ninguna localidad registra {info.plural} todavía.</p>
      ) : (
        <ol className="mt-2 space-y-0.5">
          {rows.map((r, i) => {
            const valor = metricValue(r.figures, metric);
            const contenido = (
              <>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-primary-800">
                    <span className="mr-1.5 text-primary-400">{i + 1}.</span>
                    {r.name}
                  </span>
                  <span className="shrink-0 font-semibold text-primary-700">{formatMetric(valor, metric)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary-50" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${max > 0 ? Math.max(4, (valor / max) * 100) : 0}%` }}
                  />
                </div>
              </>
            );
            return (
              <li key={r.key}>
                {r.onMap ? (
                  <button
                    type="button"
                    data-locality-id={r.key}
                    onClick={(e) => onSelect(r.key, e.currentTarget)}
                    className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className="px-2 py-1.5">{contenido}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

interface DepartmentRankingProps {
  departments: ReadonlyMap<string, LocalityFigures>;
  metric: MapMetric;
  classes: readonly HeatClass[];
}

/**
 * Los nueve departamentos con su valor y su tono: la lectura en texto de la
 * capa de colores del mapa. Los que no tienen participación van al final y lo
 * dicen, sin un cero inventado.
 */
export function DepartmentRanking({ departments, metric, classes }: DepartmentRankingProps) {
  const filas = GEO_DEPARTMENTS.map((d) => {
    const f = departments.get(d.name);
    return { name: d.name, valor: f ? metricValue(f, metric) : 0 };
  }).sort((a, b) => b.valor - a.valor || a.name.localeCompare(b.name, 'es'));

  return (
    <section aria-labelledby="ranking-departamentos">
      <h2 id="ranking-departamentos" className="text-base font-bold text-primary-800">
        Por departamento
      </h2>
      <p className="text-xs text-primary-500">El tono de cada departamento en el mapa.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {filas.map((f) => (
          <li key={f.name} className="flex items-center justify-between gap-2 px-2 py-0.5">
            <span className="flex min-w-0 items-center gap-2 text-primary-800">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
                style={{ backgroundColor: f.valor > 0 ? heatColor(f.valor, classes) : NO_DATA_COLOR }}
              />
              <span className="truncate">{f.name}</span>
            </span>
            <span className={f.valor > 0 ? 'shrink-0 font-semibold text-primary-700' : 'shrink-0 text-xs text-primary-400'}>
              {f.valor > 0 ? formatMetric(f.valor, metric) : 'Sin participación'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

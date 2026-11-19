// ===========================================
// EvolutionCard — respuestas en el tiempo, en área
// ===========================================
import type { MetricsOverview } from '@/types';
import { textoTotal } from '@/lib/metrics/metricsRules';
import { NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { ChartFrame } from './ChartFrame';

interface EvolutionCardProps {
  overview: MetricsOverview | undefined;
  umbral: number;
  grande?: boolean;
}

export function EvolutionCard({ overview, umbral, grande = false }: EvolutionCardProps) {
  return (
    <section className="card flex h-full min-w-0 flex-col gap-3 p-5" aria-labelledby="titulo-evolucion">
      <h2 id="titulo-evolucion" className="type-h3 text-primary-900">Respuestas en el tiempo</h2>
      {!overview ? (
        <div className="h-64 animate-pulse rounded-xl bg-primary-50" />
      ) : overview.serie.puntos.length === 0 ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Todavía no hay respuestas en este corte.
        </p>
      ) : (
        <>
          <ChartFrame
            tipo="lineas"
            area
            overview={overview}
            alto={grande ? 360 : 'h-64 lg:h-80'}
            etiqueta={`Respuestas en el tiempo: ${textoTotal(overview.totalRespuestas, umbral, 'en total')}`}
          />
          {overview.serie.puntos.some((p) => p.suprimido) && <NotaSupresion umbral={umbral} />}
        </>
      )}
    </section>
  );
}

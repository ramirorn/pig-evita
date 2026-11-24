// ===========================================
// DonutCard — una pregunta en dona, con su leyenda en porcentajes
// ===========================================
import type { MetricsCross } from '@/types';
import { aDatosTorta, colorDeSerie } from '@/lib/metrics/metricsRules';
import { NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { ChartFrame } from './ChartFrame';

interface DonutCardProps {
  cruce: MetricsCross | undefined;
  cargando: boolean;
  /** Selector de pregunta (lo pone la página: la pregunta en foco es compartida). */
  selector?: React.ReactNode;
  grande?: boolean;
}

export function DonutCard({ cruce, cargando, selector, grande = false }: DonutCardProps) {
  const { datos, suprimidas } = cruce ? aDatosTorta(cruce) : { datos: [], suprimidas: 0 };
  const total = datos.reduce((suma, d) => suma + d.valor, 0);
  const titulo = cruce?.pregunta.texto ?? 'Respuestas';

  return (
    <section className="card flex h-full min-w-0 flex-col gap-4 p-5" aria-labelledby="titulo-dona">
      <div className="space-y-2">
        <h2 id="titulo-dona" className="type-h3 text-primary-900">Cómo respondieron</h2>
        {selector}
      </div>
      {cargando && !cruce ? (
        <div className="h-56 animate-pulse rounded-xl bg-primary-50" />
      ) : datos.length === 0 ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          No hay respuestas publicables para esta pregunta en este corte.
        </p>
      ) : (
        <div className={grande ? 'grid items-center gap-6 md:grid-cols-2' : 'space-y-4'}>
          <ChartFrame
            tipo="torta"
            cruce={cruce}
            dona
            sinLeyenda
            alto={grande ? 320 : 220}
            etiqueta={`${titulo}: ${datos.map((d) => `${d.nombre} ${Math.round((d.valor / total) * 100)} %`).join(', ')}`}
          />
          <ul className="space-y-2" aria-label="Leyenda">
            {datos.map((d, i) => (
              <li key={d.clave} className={grande ? 'flex items-center gap-3 text-lg' : 'flex items-center gap-2 text-sm'}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorDeSerie(i) }} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-primary-800">{d.nombre}</span>
                <span className="shrink-0 font-bold tabular-nums text-primary-900">
                  {Math.round((d.valor / total) * 100)} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {suprimidas > 0 && cruce && <NotaSupresion umbral={cruce.umbral} suprimidas={suprimidas} />}
    </section>
  );
}

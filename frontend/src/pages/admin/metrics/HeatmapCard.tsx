// ===========================================
// HeatmapCard — mapa de calor departamento × opción
// ===========================================
//
// Cada celda pinta qué proporción de su departamento eligió esa opción: así
// un departamento chico y uno grande se comparan de igual a igual. Las
// celdas suprimidas por k-anonimato van rayadas, nunca en blanco (blanco
// parecería "cero").
import type { MetricsCross } from '@/types';
import { colorCalor, heatmapDesdeCruce } from '@/lib/metrics/metricsRules';

interface HeatmapCardProps {
  cruce: MetricsCross | undefined;
  cargando: boolean;
}

const RAYADO =
  'repeating-linear-gradient(135deg, var(--color-primary-100) 0 4px, var(--color-white, #ffffff) 4px 8px)';

export function HeatmapCard({ cruce, cargando }: HeatmapCardProps) {
  const mapa = cruce ? heatmapDesdeCruce(cruce) : null;
  const filas = mapa?.filas.filter((f) => f.clave !== null) ?? [];

  return (
    <section className="card flex h-full min-w-0 flex-col gap-4 p-5" aria-labelledby="titulo-calor">
      <h2 id="titulo-calor" className="type-h3 text-primary-900">Mapa de calor</h2>
      {cargando && !cruce ? (
        <div className="h-72 animate-pulse rounded-xl bg-primary-50" />
      ) : !mapa || filas.length === 0 ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Todavía no hay respuestas con departamento en este corte.
        </p>
      ) : (
        <>
          <div className="min-w-0 overflow-x-auto">
            <table className="border-separate border-spacing-1 text-xs">
              <caption className="sr-only">
                Proporción de cada respuesta a «{cruce?.pregunta.texto}» dentro de cada departamento
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sr-only">Departamento</th>
                  {mapa.columnas.map((c, i) => (
                    <th key={c.optionId} scope="col" className="w-8 font-semibold text-primary-600" title={c.texto}>
                      <span aria-hidden="true">{i + 1}</span>
                      <span className="sr-only">{c.texto}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.clave}>
                    <th scope="row" className="max-w-24 truncate pr-2 text-left font-medium text-primary-800" title={fila.etiqueta}>
                      {fila.etiqueta}
                    </th>
                    {fila.celdas.map((celda, i) => {
                      const texto = mapa.columnas[i]?.texto ?? '';
                      if (celda.suprimida) {
                        return (
                          <td key={celda.optionId} title={`${fila.etiqueta} · ${texto}: menos de 5 respuestas`}>
                            <span className="block h-7 w-8 rounded-md" style={{ background: RAYADO }} aria-label="menos de 5" />
                          </td>
                        );
                      }
                      const color = celda.intensidad === null ? null : colorCalor(celda.intensidad);
                      const porcentaje = celda.intensidad === null ? null : Math.round(celda.intensidad * 100);
                      return (
                        <td key={celda.optionId} title={`${fila.etiqueta} · ${texto}: ${celda.conteo} respuestas`}>
                          <span
                            className="flex h-7 w-8 items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
                            style={color ? { background: color.fondo, color: color.texto } : { background: 'var(--color-primary-50)' }}
                          >
                            {porcentaje === null ? celda.conteo : `${porcentaje}%`}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="grid gap-1 text-xs text-primary-700 sm:grid-cols-2" aria-label="Referencias">
            {mapa.columnas.map((c, i) => (
              <li key={c.optionId} className="min-w-0 truncate" title={c.texto}>
                <span className="font-bold tabular-nums text-primary-900">{i + 1}</span> · {c.texto}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 text-[11px] text-primary-500" aria-hidden="true">
            <span>0 %</span>
            <span
              className="h-2 flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${colorCalor(0).fondo}, ${colorCalor(0.3).fondo}, ${colorCalor(0.5).fondo}, ${colorCalor(1).fondo})` }}
            />
            <span>100 %</span>
            <span className="ml-2 inline-block h-3 w-4 rounded-sm" style={{ background: RAYADO }} />
            <span>menos de 5</span>
          </div>
        </>
      )}
    </section>
  );
}

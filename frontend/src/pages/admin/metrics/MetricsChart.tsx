// ===========================================
// MetricsChart — el gráfico, y nada más que el gráfico
// ===========================================
//
// Como `InscriptionsStatusDonut`: es el archivo que importa `recharts` para el
// panel de Métricas y se carga con `lazy()`, así la librería (95 kB gzip) no
// viaja en el chunk de la ruta. Toda la transformación de datos ya viene hecha
// desde `lib/metrics/metricsRules.ts`; acá sólo se dibuja.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { MetricsCross, MetricsOverview } from '@/types';
import {
  aDatosBarras,
  aDatosDispersion,
  aDatosSerie,
  aDatosTorta,
  colorDeSerie,
  type TipoGrafico,
} from '@/lib/metrics/metricsRules';

interface MetricsChartProps {
  tipo: TipoGrafico;
  cruce?: MetricsCross;
  overview?: MetricsOverview;
  /** Barras como porcentaje del total de cada fila. */
  porcentaje?: boolean;
  /** Avisa cuántas celdas quedaron sin dibujar por k-anonimato. */
  onSuprimidas?: (cantidad: number) => void;
}

const EJE = { fontSize: 12, fill: 'var(--color-primary-700)' };
/**
 * Tipo de eje de recharts (escala numérica), no un `<input>`. Va en una
 * constante para que se lea como lo que es al lado de `check:controls`.
 */
const EJE_NUMERICO = 'number' as const;
const GRILLA = 'var(--color-primary-100)';

function SinDatos() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-primary-500">
      No hay datos publicables para esta combinación.
    </div>
  );
}

export default function MetricsChart({
  tipo,
  cruce,
  overview,
  porcentaje = false,
  onSuprimidas,
}: MetricsChartProps) {
  if (tipo === 'lineas') {
    if (!overview) return <SinDatos />;
    const { datos, suprimidas } = aDatosSerie(overview);
    onSuprimidas?.(suprimidas);
    if (datos.length === 0) return <SinDatos />;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" />
          <XAxis dataKey="etiqueta" tick={EJE} />
          <YAxis allowDecimals={false} tick={EJE} />
          <Tooltip formatter={(v) => [v ?? 'Sin publicar', 'Respuestas']} />
          <Line
            type="monotone"
            dataKey="respuestas"
            name="Respuestas"
            stroke={colorDeSerie(0)}
            strokeWidth={2}
            dot={{ r: 3 }}
            // Un tramo suprimido corta la línea: unirlo inventaría un valor.
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (!cruce) return <SinDatos />;

  if (tipo === 'torta') {
    const { datos, suprimidas } = aDatosTorta(cruce);
    onSuprimidas?.(suprimidas);
    if (datos.length === 0) return <SinDatos />;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            label={({ percent }) => `${Math.round((percent ?? 0) * 100)} %`}
            isAnimationActive={false}
          >
            {datos.map((d, i) => (
              <Cell key={d.clave} fill={colorDeSerie(i)} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'dispersion') {
    const { datos, suprimidas } = aDatosDispersion(cruce);
    onSuprimidas?.(suprimidas);
    if (datos.length === 0) return <SinDatos />;
    const filas = cruce.filas.map((f) => f.etiqueta);
    const columnas = cruce.columnas.map((c) => c.texto);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" />
          <XAxis
            type={EJE_NUMERICO}
            dataKey="x"
            domain={[-0.5, filas.length - 0.5]}
            ticks={filas.map((_, i) => i)}
            tickFormatter={(i: number) => filas[i] ?? ''}
            tick={EJE}
            name={cruce.etiquetaDimension}
          />
          <YAxis
            type={EJE_NUMERICO}
            dataKey="y"
            domain={[-0.5, columnas.length - 0.5]}
            ticks={columnas.map((_, i) => i)}
            tickFormatter={(i: number) => columnas[i] ?? ''}
            tick={EJE}
            width={140}
            name={cruce.pregunta.texto}
          />
          <ZAxis type={EJE_NUMERICO} dataKey="conteo" range={[60, 900]} name="Respuestas" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof datos)[number] | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-primary-100 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-primary-900">{p.fila}</p>
                  <p className="text-primary-700">{p.columna}</p>
                  <p className="mt-1 font-bold text-primary-900">{p.conteo} respuestas</p>
                </div>
              );
            }}
          />
          <Scatter data={datos} fill={colorDeSerie(0)} fillOpacity={0.75} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // Barras y barras apiladas.
  const { datos, suprimidas } = aDatosBarras(cruce, { porcentaje });
  onSuprimidas?.(suprimidas);
  if (datos.length === 0) return <SinDatos />;
  const apiladas = tipo === 'barras_apiladas';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={datos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="etiqueta" tick={EJE} interval={0} />
        <YAxis
          allowDecimals={false}
          tick={EJE}
          unit={porcentaje ? ' %' : undefined}
          domain={porcentaje && apiladas ? [0, 100] : undefined}
        />
        <Tooltip formatter={(v) => (porcentaje ? `${v} %` : v)} />
        <Legend />
        {cruce.columnas.map((columna, i) => (
          <Bar
            key={columna.optionId}
            dataKey={columna.texto}
            name={columna.texto}
            fill={colorDeSerie(i)}
            stackId={apiladas ? 'pila' : undefined}
            radius={apiladas ? 0 : [4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===========================================
// MetricsChart — el gráfico, y nada más que el gráfico
// ===========================================
//
// Como `InscriptionsStatusDonut`: es el archivo que importa `recharts` para el
// panel de Métricas y se carga con `lazy()`, así la librería (95 kB gzip) no
// viaja en el chunk de la ruta. Toda la transformación de datos ya viene hecha
// desde `lib/metrics/metricsRules.ts`; acá sólo se dibuja.
import {
  Area,
  AreaChart,
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
  caracteresEnEje,
  colorDeSerie,
  disponerBarras,
  recortarEtiqueta,
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
  /** Barras horizontales: todas las filas en vez de las primeras. */
  verTodas?: boolean;
  /** Torta como dona, con el total al centro. */
  dona?: boolean;
  /** Evolución como área rellena en vez de línea. */
  area?: boolean;
  /** Oculta la leyenda de recharts (la tarjeta dibuja la suya). */
  sinLeyenda?: boolean;
}

const EJE = { fontSize: 12, fill: 'var(--color-primary-700)' };
/**
 * Tipo de eje de recharts (escala numérica), no un `<input>`. Va en una
 * constante para que se lea como lo que es al lado de `check:controls`.
 */
const EJE_NUMERICO = 'number' as const;
const EJE_CATEGORIAS = 'category' as const;
const GRILLA = 'var(--color-primary-100)';
const LEYENDA = { fontSize: 12, lineHeight: '18px' };

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
  verTodas = false,
  dona = false,
  area = false,
  sinLeyenda = false,
}: MetricsChartProps) {
  if (tipo === 'lineas') {
    if (!overview) return <SinDatos />;
    const { datos, suprimidas } = aDatosSerie(overview);
    onSuprimidas?.(suprimidas);
    if (datos.length === 0) return <SinDatos />;
    if (area) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="relleno-evolucion" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorDeSerie(0)} stopOpacity={0.55} />
                <stop offset="100%" stopColor={colorDeSerie(0)} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="etiqueta" tick={EJE} minTickGap={16} />
            <YAxis allowDecimals={false} tick={EJE} domain={[0, 'auto']} width={40} />
            <Tooltip formatter={(v) => [v ?? 'Sin publicar', 'Respuestas']} />
            <Area
              type="monotone"
              dataKey="respuestas"
              name="Respuestas"
              stroke={colorDeSerie(0)}
              strokeWidth={2}
              fill="url(#relleno-evolucion)"
              // Un tramo suprimido corta el área: unirlo inventaría un valor.
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
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
    const total = datos.reduce((suma, d) => suma + d.valor, 0);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            cx="50%"
            cy="50%"
            innerRadius={dona ? '62%' : 0}
            outerRadius="85%"
            paddingAngle={dona ? 2 : 0}
            label={dona ? false : ({ percent }) => `${Math.round((percent ?? 0) * 100)} %`}
            stroke="var(--color-white, #ffffff)"
            isAnimationActive={false}
          >
            {datos.map((d, i) => (
              <Cell key={d.clave} fill={colorDeSerie(i)} />
            ))}
          </Pie>
          {dona && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-primary-900 text-2xl font-black"
            >
              {total.toLocaleString('es-AR')}
            </text>
          )}
          <Tooltip />
          {!sinLeyenda && <Legend wrapperStyle={LEYENDA} />}
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
  const disposicion = disponerBarras(datos, { verTodas });

  if (disposicion.orientacion === 'horizontal') {
    // Muchas categorías o nombres largos: el nombre va a la izquierda de su
    // barra y nunca se enciman (recharts llama `vertical` a este layout).
    const maximo = caracteresEnEje(disposicion.anchoEje);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={disposicion.filas}
          margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type={EJE_NUMERICO}
            allowDecimals={false}
            tick={EJE}
            unit={porcentaje ? ' %' : undefined}
            domain={porcentaje && apiladas ? [0, 100] : [0, 'auto']}
          />
          <YAxis
            type={EJE_CATEGORIAS}
            dataKey="etiqueta"
            width={disposicion.anchoEje}
            interval={0}
            tick={EJE}
            tickFormatter={(t: string) => recortarEtiqueta(t, maximo)}
          />
          <Tooltip formatter={(v) => (porcentaje ? `${v} %` : v)} />
          <Legend wrapperStyle={LEYENDA} />
          {cruce.columnas.map((columna, i) => (
            <Bar
              key={columna.optionId}
              dataKey={columna.texto}
              name={columna.texto}
              fill={colorDeSerie(i)}
              stackId={apiladas ? 'pila' : undefined}
              radius={apiladas ? 0 : [0, 4, 4, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={disposicion.filas} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={GRILLA} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="etiqueta" tick={EJE} interval={0} />
        <YAxis
          allowDecimals={false}
          tick={EJE}
          unit={porcentaje ? ' %' : undefined}
          domain={porcentaje && apiladas ? [0, 100] : undefined}
        />
        <Tooltip formatter={(v) => (porcentaje ? `${v} %` : v)} />
        <Legend wrapperStyle={LEYENDA} />
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

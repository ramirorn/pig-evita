// ===========================================
// ChartBuilder — elegir qué cruzar y cómo verlo
// ===========================================
//
// El administrador elige una pregunta, un desglose opcional (zona,
// departamento, disciplina, otra pregunta…) y el tipo de gráfico. Con "comparar"
// se dibujan dos cortes lado a lado con la misma configuración: por ejemplo,
// capital contra interior.
import { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  MetricsCatalog,
  MetricsCross,
  MetricsDimension,
  MetricsFiltros,
  MetricsOverview,
} from '@/types';
import { useMetricsCross } from '@/hooks/useMetrics';
import {
  ETIQUETAS_GRAFICO,
  DIMENSION_SIN_DESGLOSE,
  aDatosBarras,
  ajustarTipo,
  disponerBarras,
  nombreArchivo,
  tablaACsv,
  textoTotal,
  tiposDisponibles,
  type TipoGrafico,
} from '@/lib/metrics/metricsRules';
import { SelectField } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ConteoCorte, NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { descargarCsv, exportarSvgComoPng } from './exportarGrafico';

const MetricsChart = lazy(() => import('./MetricsChart'));

interface ChartBuilderProps {
  campaignId: string;
  version: number | undefined;
  catalogo: MetricsCatalog;
  filtros: MetricsFiltros;
  /** Segundo corte para comparar; `undefined` = un solo gráfico. */
  filtrosComparacion?: MetricsFiltros;
  etiquetas?: { a: string; b: string };
  overview?: MetricsOverview;
  overviewComparacion?: MetricsOverview;
}

function ChartPanel({
  titulo,
  tipo,
  cruce,
  overview,
  porcentaje,
  cargando,
  umbral,
}: {
  titulo?: string;
  tipo: TipoGrafico;
  cruce: MetricsCross | undefined;
  overview: MetricsOverview | undefined;
  porcentaje: boolean;
  cargando: boolean;
  umbral: number;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [suprimidas, setSuprimidas] = useState(0);
  const [verTodas, setVerTodas] = useState(false);

  // Barras con muchas categorías: el alto lo dan las filas, no el contenedor.
  const esBarras = tipo === 'barras' || tipo === 'barras_apiladas';
  const disposicion =
    esBarras && cruce ? disponerBarras(aDatosBarras(cruce, { porcentaje }).datos, { verTodas }) : null;
  const alto = disposicion?.alto ?? null;

  const exportarPng = async () => {
    if (!contenedor.current) return;
    const base = `${cruce?.pregunta.texto ?? 'respuestas'} ${titulo ?? ''}`;
    const ok = await exportarSvgComoPng(contenedor.current, nombreArchivo(base, 'png'));
    if (!ok) toast.error('No hay gráfico para exportar');
  };

  const exportarCsv = () => {
    if (!cruce) return;
    descargarCsv(tablaACsv(cruce), nombreArchivo(`${cruce.pregunta.texto} por ${cruce.etiquetaDimension} ${titulo ?? ''}`, 'csv'));
  };

  return (
    <div className="min-w-0 space-y-3">
      {titulo && <p className="text-sm font-bold text-primary-800">{titulo}</p>}
      <div
        ref={contenedor}
        className={alto === null ? 'relative h-80 w-full' : 'relative w-full'}
        style={alto === null ? undefined : { height: alto }}
        data-testid="metrics-chart"
      >
        {cargando && !cruce && !overview ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-400" aria-hidden="true" />
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary-400" aria-hidden="true" />
              </div>
            }
          >
            <MetricsChart
              tipo={tipo}
              cruce={cruce}
              overview={overview}
              porcentaje={porcentaje}
              onSuprimidas={setSuprimidas}
              verTodas={verTodas}
            />
          </Suspense>
        )}
      </div>
      {disposicion && (disposicion.ocultas > 0 || verTodas) && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? 'Ver menos' : `Ver todas (${disposicion.ocultas} más)`}
        </Button>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-primary-500">
          {tipo === 'lineas'
            ? overview && textoTotal(overview.totalRespuestas, umbral, 'en el corte')
            : cruce && textoTotal(cruce.totalRespuestas, umbral, 'contestaron esta pregunta')}
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={exportarPng} className="gap-1.5">
            <Download className="h-4 w-4" aria-hidden="true" />
            PNG
          </Button>
          {tipo !== 'lineas' && (
            <Button type="button" size="sm" variant="outline" onClick={exportarCsv} disabled={!cruce} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
          )}
        </div>
      </div>
      {suprimidas > 0 && <NotaSupresion umbral={umbral} suprimidas={suprimidas} />}
      {tipo !== 'lineas' && cruce && cruce.filas.length > 0 && (
        <details className="rounded-lg border border-primary-100">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-primary-700">Ver la tabla</summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary-50 text-xs text-primary-600">
                <tr>
                  <th className="px-3 py-2 text-left">{cruce.etiquetaDimension}</th>
                  {cruce.columnas.map((c) => (
                    <th key={c.optionId} className="px-3 py-2 text-right">{c.texto}</th>
                  ))}
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {cruce.filas.map((f) => (
                  <tr key={f.clave ?? 'sin-dato'}>
                    <td className="px-3 py-2 font-medium text-primary-800">{f.etiqueta}</td>
                    {f.celdas.map((c) => (
                      <td key={c.optionId} className="px-3 py-2">
                        <ConteoCorte corte={c} umbral={cruce.umbral} className="justify-end" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <ConteoCorte corte={f.totalFila} umbral={cruce.umbral} className="justify-end font-semibold" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export function ChartBuilder({
  campaignId,
  version,
  catalogo,
  filtros,
  filtrosComparacion,
  etiquetas = { a: 'Corte A', b: 'Corte B' },
  overview,
  overviewComparacion,
}: ChartBuilderProps) {
  const preguntas = catalogo.preguntas;
  const [preguntaId, setPreguntaId] = useState<string>(preguntas[0]?.questionId ?? '');
  const [desglose, setDesglose] = useState<string>('zona');
  const [tipoElegido, setTipoElegido] = useState<TipoGrafico>('barras');
  const [porcentaje, setPorcentaje] = useState(false);

  const dimension = (desglose || undefined) as MetricsDimension | undefined;
  const tipo = ajustarTipo(tipoElegido, dimension);
  const por = dimension ?? DIMENSION_SIN_DESGLOSE;

  const opcionesDesglose = useMemo(
    () => [
      ...catalogo.dimensiones.map((d) => ({ value: d.clave, label: d.etiqueta })),
      ...preguntas
        .filter((p) => p.questionId !== preguntaId)
        .map((p) => ({ value: `pregunta:${p.questionId}`, label: `Otra pregunta: ${p.orden}. ${p.texto}` })),
    ],
    [catalogo.dimensiones, preguntas, preguntaId],
  );

  const cruceA = useMetricsCross(campaignId, version, preguntaId, por, filtros);
  const cruceB = useMetricsCross(
    filtrosComparacion ? campaignId : null,
    version,
    preguntaId,
    por,
    filtrosComparacion,
  );

  if (preguntas.length === 0) {
    return (
      <p className="card p-5 text-sm text-primary-600">
        Esta campaña todavía no tiene preguntas para graficar.
      </p>
    );
  }

  return (
    <section className="card space-y-5 p-5 md:p-6" aria-labelledby="titulo-constructor">
      <h2 id="titulo-constructor" className="type-h3 flex items-center gap-2 text-primary-900">
        <BarChart3 className="h-5 w-5 text-primary-500" aria-hidden="true" />
        Explorar las respuestas
      </h2>

      <div className="grid gap-3 md:grid-cols-[2fr_1.5fr_1fr]">
        <div className="min-w-0">
          <label htmlFor="builder-pregunta" className="text-xs font-semibold text-primary-700">Pregunta</label>
          <SelectField
            id="builder-pregunta"
            value={preguntaId}
            onValueChange={(v) => {
              setPreguntaId(v);
              if (desglose === `pregunta:${v}`) setDesglose('zona');
            }}
            options={preguntas.map((p) => ({ value: p.questionId, label: `${p.orden}. ${p.texto}` }))}
            className="mt-1"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="builder-desglose" className="text-xs font-semibold text-primary-700">Desglosar por</label>
          <SelectField
            id="builder-desglose"
            value={desglose}
            onValueChange={setDesglose}
            emptyOptionLabel="Sin desglose"
            options={opcionesDesglose}
            className="mt-1"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="builder-tipo" className="text-xs font-semibold text-primary-700">Gráfico</label>
          <SelectField
            id="builder-tipo"
            value={tipo}
            onValueChange={(v) => setTipoElegido(v as TipoGrafico)}
            options={tiposDisponibles(dimension).map((t) => ({ value: t, label: ETIQUETAS_GRAFICO[t] }))}
            className="mt-1"
          />
        </div>
      </div>

      {(tipo === 'barras' || tipo === 'barras_apiladas') && dimension && (
        <Checkbox
          checked={porcentaje}
          onCheckedChange={setPorcentaje}
          label="Mostrar como porcentaje de cada fila"
        />
      )}

      <div className={filtrosComparacion ? 'grid gap-6 lg:grid-cols-2' : ''}>
        <ChartPanel
          titulo={filtrosComparacion ? etiquetas.a : undefined}
          tipo={tipo}
          cruce={cruceA.data}
          overview={overview}
          porcentaje={porcentaje}
          cargando={cruceA.isLoading}
          umbral={catalogo.umbral}
        />
        {filtrosComparacion && (
          <ChartPanel
            titulo={etiquetas.b}
            tipo={tipo}
            cruce={cruceB.data}
            overview={overviewComparacion}
            porcentaje={porcentaje}
            cargando={cruceB.isLoading}
            umbral={catalogo.umbral}
          />
        )}
      </div>
    </section>
  );
}

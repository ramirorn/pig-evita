// ===========================================
// MetricsPage — métricas e indicadores de la encuesta
// ===========================================
//
// Tablero para la toma de decisiones de la Secretaría: indicadores (KPIs)
// compuestos a partir de las respuestas, evolución en el tiempo y un
// constructor de gráficos para cruzar cualquier pregunta con cualquier corte
// (zona, departamento, disciplina, otra pregunta…). Se actualiza solo a
// medida que llegan respuestas (polling de la versión de la campaña).
//
// Todo es anónimo y agregado: los cortes con menos respuestas que el umbral
// de k-anonimato se muestran como "sin publicar", nunca como cero.
import { Suspense, lazy, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, BarChart3, Columns2, LineChart, Loader2, MapPin, Users } from 'lucide-react';
import type { MetricsFiltros } from '@/types';
import { SURVEY_CAMPAIGN_STATUS_LABELS } from '@/lib/constants';
import {
  useMetricsCatalog,
  useMetricsKpis,
  useMetricsOverview,
  useMetricsVersion,
} from '@/hooks/useMetrics';
import { usePermisos } from '@/hooks/usePermisos';
import { filtrosABusqueda, filtrosDesdeBusqueda } from '@/lib/metrics/metricsRules';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SelectField } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ConteoCorte, NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { MetricsFilterBar } from './metrics/MetricsFilterBar';
import { KpiCards } from './metrics/KpiCards';
import { ChartBuilder } from './metrics/ChartBuilder';
import { LiveIndicator } from './metrics/LiveIndicator';

const MetricsChart = lazy(() => import('./metrics/MetricsChart'));

export function MetricsPage() {
  const [busqueda, setBusqueda] = useSearchParams();
  const campaniaPedida = busqueda.get('campania') ?? undefined;
  const filtros = useMemo(() => filtrosDesdeBusqueda(busqueda), [busqueda]);
  const [comparando, setComparando] = useState(false);
  const [filtrosB, setFiltrosB] = useState<MetricsFiltros>({ zona: 'INTERIOR' });
  const { puede } = usePermisos();

  const catalogo = useMetricsCatalog(campaniaPedida);
  const campaignId = catalogo.data?.campaniaId ?? null;
  const version = useMetricsVersion(campaignId);
  const overview = useMetricsOverview(campaignId, version.data, filtros);
  const overviewB = useMetricsOverview(comparando ? campaignId : null, version.data, filtrosB);
  const kpis = useMetricsKpis(campaignId, version.data, filtros);

  const cambiarFiltros = (siguientes: MetricsFiltros) =>
    setBusqueda(filtrosABusqueda(siguientes, busqueda), { replace: true });
  const cambiarCampania = (id: string) => {
    const siguiente = new URLSearchParams(busqueda);
    siguiente.set('campania', id);
    setBusqueda(siguiente, { replace: true });
  };

  const encabezado = (
    <PageHeader
      title="Métricas"
      description="Indicadores de la encuesta para la toma de decisiones. Se actualizan solos a medida que llegan respuestas."
      icon={<BarChart3 className="h-5 w-5 text-white" />}
      actions={
        campaignId ? (
          <LiveIndicator actualizadoEn={version.dataUpdatedAt} error={version.isError} />
        ) : undefined
      }
    />
  );

  if (catalogo.isLoading) {
    return (
      <div className="space-y-6">
        {encabezado}
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (catalogo.isError || !catalogo.data) {
    return (
      <div className="space-y-6">
        {encabezado}
        <div className="card">
          <EmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title="No pudimos cargar las métricas"
            description="Volvé a intentarlo en unos minutos. Si el problema sigue, avisale al equipo técnico."
            action={<Button onClick={() => catalogo.refetch()}>Reintentar</Button>}
          />
        </div>
      </div>
    );
  }

  const datos = catalogo.data;
  if (!campaignId) {
    return (
      <div className="space-y-6">
        {encabezado}
        <div className="card">
          <EmptyState
            icon={<BarChart3 className="h-10 w-10" />}
            title="Todavía no hay encuestas"
            description="Cuando se cree y publique una campaña de encuesta, sus métricas van a aparecer acá."
          />
        </div>
      </div>
    );
  }

  const resumen = overview.data;
  const porZona = (zona: 'CAPITAL' | 'INTERIOR') => resumen?.porZona.find((z) => z.zona === zona);
  const umbral = datos.umbral;

  return (
    <div className="space-y-6">
      {encabezado}

      {/* Campaña + filtros */}
      <section className="card space-y-4 p-5 md:p-6" aria-label="Filtros">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr] md:items-end">
          <div className="min-w-0">
            <label htmlFor="metricas-campania" className="text-xs font-semibold text-primary-700">Campaña</label>
            <SelectField
              id="metricas-campania"
              value={campaignId}
              onValueChange={cambiarCampania}
              options={datos.campanias.map((c) => ({
                value: c.id,
                label: `${c.titulo} · ${c.anio} · ${SURVEY_CAMPAIGN_STATUS_LABELS[c.status]} (${c.totalRespuestas} respuestas)`,
              }))}
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            variant={comparando ? 'secondary' : 'outline'}
            onClick={() => setComparando((v) => !v)}
            className="gap-2"
            aria-pressed={comparando}
          >
            <Columns2 className="h-4 w-4" aria-hidden="true" />
            {comparando ? 'Dejar de comparar' : 'Comparar dos cortes'}
          </Button>
        </div>
        <MetricsFilterBar filtros={filtros} onChange={cambiarFiltros} catalogo={datos} />
        {comparando && (
          <div className="rounded-xl border border-dashed border-primary-200 p-4">
            <p className="mb-3 text-sm font-bold text-primary-800">Corte B (para comparar)</p>
            <MetricsFilterBar
              filtros={filtrosB}
              onChange={setFiltrosB}
              catalogo={datos}
              compacto
              idPrefijo="metricas-b"
            />
          </div>
        )}
      </section>

      {/* Resumen */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen">
        <div className="card flex items-center gap-4 p-5">
          <Users className="h-8 w-8 shrink-0 text-primary-400" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Respuestas en el corte</p>
            <p className="text-3xl font-black tabular-nums text-primary-900" data-testid="metricas-total">
              {resumen?.totalRespuestas ?? '—'}
            </p>
          </div>
        </div>
        {(['CAPITAL', 'INTERIOR'] as const).map((zona) => {
          const corte = porZona(zona);
          return (
            <div key={zona} className="card flex items-center gap-4 p-5">
              <MapPin className="h-8 w-8 shrink-0 text-primary-400" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">
                  {zona === 'CAPITAL' ? 'Capital' : 'Interior'}
                </p>
                <div className="text-3xl font-black tabular-nums text-primary-900">
                  {corte ? <ConteoCorte corte={corte} umbral={umbral} /> : '—'}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <NotaSupresion umbral={umbral} />

      <KpiCards
        campaignId={campaignId}
        resultado={kpis.data}
        cargando={kpis.isLoading}
        preguntas={datos.preguntas}
        puedeEditar={puede('SURVEY_MANAGE')}
      />

      <ChartBuilder
        campaignId={campaignId}
        version={version.data}
        catalogo={datos}
        filtros={filtros}
        filtrosComparacion={comparando ? filtrosB : undefined}
        etiquetas={{ a: 'Corte A (filtros de arriba)', b: 'Corte B' }}
        overview={resumen}
        overviewComparacion={overviewB.data}
      />

      {/* Evolución en el tiempo, siempre a la vista */}
      <section className="card space-y-3 p-5 md:p-6" aria-labelledby="titulo-evolucion">
        <h2 id="titulo-evolucion" className="type-h3 flex items-center gap-2 text-primary-900">
          <LineChart className="h-5 w-5 text-primary-500" aria-hidden="true" />
          Respuestas en el tiempo
        </h2>
        <p className="text-sm text-primary-600">
          Elegí "Evolución en el tiempo" en el constructor de arriba para comparar dos cortes; acá se muestra el
          corte actual.
        </p>
        <EvolucionSimple overview={resumen} umbral={umbral} />
      </section>
    </div>
  );
}

/** Serie del corte actual con el gráfico de líneas (mismo componente lazy). */
function EvolucionSimple({
  overview,
  umbral,
}: {
  overview: ReturnType<typeof useMetricsOverview>['data'];
  umbral: number;
}) {
  if (!overview) {
    return <p className="text-sm text-primary-500">Cargando…</p>;
  }
  if (overview.serie.puntos.length === 0) {
    return <p className="text-sm text-primary-500">Todavía no hay respuestas en este corte.</p>;
  }
  return (
    <div className="space-y-2">
      <SerieLazy overview={overview} />
      {overview.serie.puntos.some((p) => p.suprimido) && <NotaSupresion umbral={umbral} />}
    </div>
  );
}

function SerieLazy({ overview }: { overview: NonNullable<ReturnType<typeof useMetricsOverview>['data']> }) {
  return (
    <div className="h-64 w-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-400" aria-hidden="true" />
          </div>
        }
      >
        <MetricsChart tipo="lineas" overview={overview} />
      </Suspense>
    </div>
  );
}

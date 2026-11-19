// ===========================================
// MetricsPage — métricas e indicadores de la encuesta
// ===========================================
//
// Tablero para la toma de decisiones de la Secretaría, de lo simple a lo
// técnico:
//   1. tarjetas de número grande (respuestas, capital, interior, indicadores);
//   2. "Lo más importante": destacados en lenguaje simple + evolución;
//   3. una pregunta en foco en dona, por departamento y en mapa de calor;
//   4. "Explorar en detalle": el constructor de gráficos para cruzar todo;
//   5. "Detalle técnico": cómo se protege el anonimato.
// Se actualiza solo a medida que llegan respuestas (polling de la versión).
//
// Todo es anónimo y agregado: los cortes con menos respuestas que el umbral
// de k-anonimato se muestran como "sin publicar", nunca como cero.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Columns2,
  Loader2,
  Presentation,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { MetricsFiltros } from '@/types';
import { ROUTES, SURVEY_CAMPAIGN_STATUS_LABELS } from '@/lib/constants';
import {
  useMetricsCatalog,
  useMetricsCross,
  useMetricsHighlights,
  useMetricsKpis,
  useMetricsOverview,
  useMetricsVersion,
} from '@/hooks/useMetrics';
import { usePermisos } from '@/hooks/usePermisos';
import {
  DIMENSION_SIN_DESGLOSE,
  filtrosABusqueda,
  filtrosDesdeBusqueda,
  hayFiltrosActivos,
} from '@/lib/metrics/metricsRules';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SelectField } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ConteoCorte, NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { MetricsFilterBar } from './metrics/MetricsFilterBar';
import { KpiCards } from './metrics/KpiCards';
import { ChartBuilder } from './metrics/ChartBuilder';
import { LiveIndicator } from './metrics/LiveIndicator';
import { StatTile } from './metrics/StatTile';
import { PeriodSwitch } from './metrics/PeriodSwitch';
import { HighlightsSection } from './metrics/HighlightsSection';
import { EvolutionCard } from './metrics/EvolutionCard';
import { DonutCard } from './metrics/DonutCard';
import { TerritoryCard } from './metrics/TerritoryCard';
import { HeatmapCard } from './metrics/HeatmapCard';

/** Bloque plegable con su botón (sin `<details>`: el botón lleva `aria-expanded`). */
function Plegable({
  id,
  titulo,
  icono,
  abierto,
  onToggle,
  children,
}: {
  id: string;
  titulo: string;
  icono: ReactNode;
  abierto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary-100 bg-white px-5 py-4 text-left font-bold text-primary-900 transition-colors duration-120 hover:bg-primary-50"
      >
        <span className="flex items-center gap-2">
          {icono}
          {titulo}
        </span>
        <ChevronDown className={cn('h-5 w-5 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
      </button>
      {abierto && (
        <div id={id} className="space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}

export function MetricsPage() {
  const [busqueda, setBusqueda] = useSearchParams();
  const campaniaPedida = busqueda.get('campania') ?? undefined;
  const filtros = useMemo(() => filtrosDesdeBusqueda(busqueda), [busqueda]);
  const [comparando, setComparando] = useState(false);
  const [filtrosB, setFiltrosB] = useState<MetricsFiltros>({ zona: 'INTERIOR' });
  const [verFiltros, setVerFiltros] = useState(() => hayFiltrosActivos(filtros));
  const [explorar, setExplorar] = useState(false);
  const [tecnico, setTecnico] = useState(false);
  const [preguntaElegida, setPreguntaElegida] = useState<string | null>(null);
  const { puede } = usePermisos();

  const catalogo = useMetricsCatalog(campaniaPedida);
  const campaignId = catalogo.data?.campaniaId ?? null;
  const version = useMetricsVersion(campaignId);
  const overview = useMetricsOverview(campaignId, version.data, filtros);
  const overviewB = useMetricsOverview(comparando ? campaignId : null, version.data, filtrosB);
  const kpis = useMetricsKpis(campaignId, version.data, filtros);
  const destacados = useMetricsHighlights(campaignId, version.data, filtros);

  // Pregunta en foco (dona, departamentos y mapa de calor): la elegida o, si
  // no, la del primer destacado, que es la que más le importa a la Secretaría.
  const preguntas = catalogo.data?.preguntas ?? [];
  const valorDestacado = destacados.data?.destacados[0]?.opciones[0]?.valor;
  const preguntaFoco =
    preguntaElegida ??
    preguntas.find((p) => p.opciones.some((o) => o.valor === valorDestacado))?.questionId ??
    preguntas[0]?.questionId ??
    '';
  const cruceFoco = useMetricsCross(campaignId, version.data, preguntaFoco, DIMENSION_SIN_DESGLOSE, filtros);
  const crucePorDepartamento = useMetricsCross(campaignId, version.data, preguntaFoco, 'departamento', filtros);

  const cambiarFiltros = (siguientes: MetricsFiltros) =>
    setBusqueda(filtrosABusqueda(siguientes, busqueda), { replace: true });
  const cambiarCampania = (id: string) => {
    const siguiente = new URLSearchParams(busqueda);
    siguiente.set('campania', id);
    setBusqueda(siguiente, { replace: true });
  };

  const presentar = (() => {
    const params = new URLSearchParams(busqueda);
    if (campaignId) params.set('campania', campaignId);
    if (preguntaFoco) params.set('pregunta', preguntaFoco);
    return `${ROUTES.METRICS_PRESENT}?${params.toString()}`;
  })();

  const encabezado = (
    <PageHeader
      title="Métricas"
      description="Lo que dicen los deportistas en la encuesta, en números simples. Se actualiza solo a medida que llegan respuestas."
      icon={<BarChart3 className="h-5 w-5 text-white" />}
      actions={
        campaignId ? (
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator actualizadoEn={version.dataUpdatedAt} error={version.isError} />
            <Button asChild variant="secondary" size="sm" className="gap-1.5">
              <Link to={presentar} target="_blank" rel="noopener">
                <Presentation className="h-4 w-4" aria-hidden="true" />
                Presentar
              </Link>
            </Button>
          </div>
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
  const umbral = datos.umbral;
  const porZona = (zona: 'CAPITAL' | 'INTERIOR') => resumen?.porZona.find((z) => z.zona === zona);
  const cantidadFiltros = Object.values(filtros).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {encabezado}

      {/* Campaña, período y filtros */}
      <section className="card space-y-4 p-4 md:p-5" aria-label="Filtros">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 basis-72">
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
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSwitch filtros={filtros} onChange={cambiarFiltros} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerFiltros((v) => !v)}
              aria-expanded={verFiltros}
              aria-controls="metricas-filtros"
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtros
              {cantidadFiltros > 0 && (
                <span className="rounded-full bg-primary-800 px-1.5 text-xs font-semibold leading-5 text-white">
                  {cantidadFiltros}
                </span>
              )}
            </Button>
          </div>
        </div>
        {verFiltros && (
          <div id="metricas-filtros">
            <MetricsFilterBar filtros={filtros} onChange={cambiarFiltros} catalogo={datos} />
          </div>
        )}
      </section>

      {/* 1. Números grandes */}
      <KpiCards
        campaignId={campaignId}
        resultado={kpis.data}
        cargando={kpis.isLoading}
        preguntas={datos.preguntas}
        puedeEditar={puede('SURVEY_MANAGE')}
        cantidadResumen={3}
        resumen={
          <>
            <StatTile
              etiqueta="Respuestas en el corte"
              valor={resumen ? <ConteoCorte corte={resumen.totalRespuestas} umbral={umbral} /> : '—'}
              testId="metricas-total"
              tendencia={resumen?.serie.puntos.map((p) => (p.suprimido ? null : p.conteo))}
            />
            {(['CAPITAL', 'INTERIOR'] as const).map((zona, i) => {
              const corte = porZona(zona);
              return (
                <StatTile
                  key={zona}
                  etiqueta={zona === 'CAPITAL' ? 'Capital' : 'Interior'}
                  acento={i === 0 ? 'secondary' : 'primary'}
                  valor={corte ? <ConteoCorte corte={corte} umbral={umbral} /> : '—'}
                />
              );
            })}
          </>
        }
      />

      {/* 2. Lo más importante + evolución */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <HighlightsSection
            campaignId={campaignId}
            resultado={destacados.data}
            cargando={destacados.isLoading}
            preguntas={datos.preguntas}
            puedeEditar={puede('SURVEY_MANAGE')}
          />
        </div>
        <div className="min-w-0 lg:col-span-7 lg:pt-11">
          <EvolutionCard overview={resumen} umbral={umbral} />
        </div>
      </div>

      {/* 3. Una pregunta en foco */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <DonutCard
          cruce={cruceFoco.data}
          cargando={cruceFoco.isLoading}
          selector={
            <SelectField
              aria-label="Pregunta en foco"
              value={preguntaFoco}
              onValueChange={setPreguntaElegida}
              options={preguntas.map((p) => ({ value: p.questionId, label: `${p.orden}. ${p.texto}` }))}
            />
          }
        />
        <TerritoryCard cruce={crucePorDepartamento.data} cargando={crucePorDepartamento.isLoading} />
        <div className="min-w-0 lg:col-span-2 xl:col-span-1">
          <HeatmapCard cruce={crucePorDepartamento.data} cargando={crucePorDepartamento.isLoading} />
        </div>
      </div>

      {/* 4. Explorar en detalle */}
      <Plegable
        id="metricas-explorar"
        titulo="Explorar en detalle"
        icono={<BarChart3 className="h-5 w-5 text-primary-500" aria-hidden="true" />}
        abierto={explorar}
        onToggle={() => setExplorar((v) => !v)}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
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
        {comparando && (
          <div className="card rounded-xl border border-dashed border-primary-200 p-4">
            <p className="mb-3 text-sm font-bold text-primary-800">Corte B (para comparar)</p>
            <MetricsFilterBar filtros={filtrosB} onChange={setFiltrosB} catalogo={datos} compacto idPrefijo="metricas-b" />
          </div>
        )}
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
      </Plegable>

      {/* 5. Detalle técnico */}
      <Plegable
        id="metricas-tecnico"
        titulo="Detalle técnico: cómo se protege el anonimato"
        icono={<ShieldCheck className="h-5 w-5 text-secondary-500" aria-hidden="true" />}
        abierto={tecnico}
        onToggle={() => setTecnico((v) => !v)}
      >
        <div className="card space-y-3 p-5 text-sm leading-relaxed text-primary-700">
          <NotaSupresion umbral={umbral} />
          <p>
            Ningún número se publica si representa a menos de {umbral} personas. Tampoco se publica un número que,
            restado de un total que se ve en otro lado, permitiría deducir un grupo chico: por eso a veces una
            opción con muchas respuestas también aparece oculta.
          </p>
          <p>
            Las frases como «4 de cada 10» sólo aparecen cuando el destacado tiene al menos{' '}
            {destacados.data?.minimoFrases ?? 30} respuestas. Con menos, los porcentajes se muestran pero no se
            redactan conclusiones.
          </p>
        </div>
      </Plegable>
    </div>
  );
}

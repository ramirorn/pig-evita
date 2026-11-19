// ===========================================
// MetricsPresentationPage — Métricas para proyectar en una reunión
// ===========================================
//
// Pantalla completa, sin menú ni filtros ni editores: números grandes, los
// destacados en lenguaje simple, una pregunta en dona y la evolución. Usa el
// mismo corte (campaña y filtros de la URL) con el que se abrió desde el
// panel, y se sigue actualizando sola mientras está abierta.
//
// No permite bajar a cortes más chicos que el panel: todo lo que muestra ya
// pasó por el k-anonimato del backend.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Loader2, Lock, LogOut } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import {
  useMetricsCatalog,
  useMetricsCross,
  useMetricsHighlights,
  useMetricsKpis,
  useMetricsOverview,
  useMetricsVersion,
} from '@/hooks/useMetrics';
import {
  DIMENSION_SIN_DESGLOSE,
  filtrosDesdeBusqueda,
  formatearKpi,
  hayFiltrosActivos,
} from '@/lib/metrics/metricsRules';
import { Button } from '@/components/ui/button';
import { ConteoCorte } from '@/pages/admin/survey/SupresionKAnonimato';
import { StatTile } from './metrics/StatTile';
import { HighlightCard } from './metrics/HighlightCard';
import { DonutCard } from './metrics/DonutCard';
import { EvolutionCard } from './metrics/EvolutionCard';
import { LiveIndicator } from './metrics/LiveIndicator';

/** Indicadores que entran en la fila de arriba además del resumen. */
const KPIS_EN_PRESENTACION = 2;

export function MetricsPresentationPage() {
  const [busqueda] = useSearchParams();
  const filtros = useMemo(() => filtrosDesdeBusqueda(busqueda), [busqueda]);
  const catalogo = useMetricsCatalog(busqueda.get('campania') ?? undefined);
  const campaignId = catalogo.data?.campaniaId ?? null;
  const version = useMetricsVersion(campaignId);
  const overview = useMetricsOverview(campaignId, version.data, filtros);
  const kpis = useMetricsKpis(campaignId, version.data, filtros);
  const destacados = useMetricsHighlights(campaignId, version.data, filtros);

  // La pregunta de la dona: la que venía en foco en el panel o, si no, la del
  // primer destacado.
  const preguntas = catalogo.data?.preguntas ?? [];
  const valorDestacado = destacados.data?.destacados[0]?.opciones[0]?.valor;
  const preguntaId =
    busqueda.get('pregunta') ??
    preguntas.find((p) => p.opciones.some((o) => o.valor === valorDestacado))?.questionId ??
    preguntas[0]?.questionId ??
    '';
  const cruce = useMetricsCross(campaignId, version.data, preguntaId, DIMENSION_SIN_DESGLOSE, filtros);

  const volver = `${ROUTES.METRICS}?${busqueda.toString()}`;
  const datos = catalogo.data;
  const campania = datos?.campanias.find((c) => c.id === campaignId);
  const resumen = overview.data;
  const umbral = datos?.umbral ?? 5;

  if (catalogo.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" aria-hidden="true" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 lg:px-12">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-widest text-secondary-600">Juegos Evita · Formosa</p>
            <h1 className="text-4xl font-black text-primary-900 lg:text-5xl">
              {campania ? campania.titulo : 'Métricas de la encuesta'}
            </h1>
            {hayFiltrosActivos(filtros) && (
              <p className="mt-2 text-sm font-semibold text-primary-600">Con filtros aplicados desde el panel</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {campaignId && <LiveIndicator actualizadoEn={version.dataUpdatedAt} error={version.isError} />}
            <Button asChild variant="outline" className="gap-2">
              <Link to={volver}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Salir de la presentación
              </Link>
            </Button>
          </div>
        </header>

        {!campaignId || !datos ? (
          <p className="card p-8 text-xl text-primary-700">
            Todavía no hay una encuesta con respuestas para presentar.
          </p>
        ) : (
          <>
            <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile
                grande
                etiqueta="Respuestas"
                valor={resumen ? <ConteoCorte corte={resumen.totalRespuestas} umbral={umbral} /> : '—'}
                tendencia={resumen?.serie.puntos.map((p) => (p.suprimido ? null : p.conteo))}
              />
              {(['CAPITAL', 'INTERIOR'] as const).map((zona, i) => {
                const corte = resumen?.porZona.find((z) => z.zona === zona);
                return (
                  <StatTile
                    grande
                    key={zona}
                    etiqueta={zona === 'CAPITAL' ? 'Capital' : 'Interior'}
                    acento={i === 0 ? 'secondary' : 'primary'}
                    valor={corte ? <ConteoCorte corte={corte} umbral={umbral} /> : '—'}
                  />
                );
              })}
              {(kpis.data?.kpis ?? []).slice(0, KPIS_EN_PRESENTACION).map((kpi, i) => (
                <StatTile
                  grande
                  key={kpi.id}
                  etiqueta={kpi.nombre}
                  acento={i === 0 ? 'secondary' : 'primary'}
                  valor={formatearKpi(kpi)}
                />
              ))}
            </section>

            {/* Destacados, evolución y dona en dos columnas. Son destacados + 2
                tarjetas: con una cantidad impar de destacados la dona queda
                sola al final y ocupa el ancho completo. */}
            <section aria-label="Lo más importante" className="grid gap-6 lg:grid-cols-2">
              {(destacados.data?.destacados ?? []).map((d) => (
                <HighlightCard
                  grande
                  key={d.id}
                  destacado={d}
                  generadoEn={destacados.data!.generadoEn}
                  umbral={destacados.data!.umbral}
                  minimoFrases={destacados.data!.minimoFrases}
                />
              ))}
              <EvolutionCard grande overview={resumen} umbral={umbral} />
              <div className={(destacados.data?.destacados.length ?? 0) % 2 === 1 ? 'min-w-0 lg:col-span-2' : 'min-w-0'}>
                <DonutCard
                  grande
                  cruce={cruce.data}
                  cargando={cruce.isLoading}
                  selector={
                    cruce.data && <p className="text-lg font-semibold text-primary-700">{cruce.data.pregunta.texto}</p>
                  }
                />
              </div>
            </section>

            <footer className="flex items-center gap-2 border-t border-primary-100 pt-4 text-sm text-primary-600">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              Datos anónimos y agregados: ningún grupo de menos de {umbral} personas se muestra.
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

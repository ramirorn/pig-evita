// ===========================================
// KpiCards — los indicadores del corte, en tarjetas de número grande
// ===========================================
//
// Primero van las tarjetas de resumen que arma la página (respuestas,
// capital, interior) y después un `StatTile` por indicador, alternando el
// borde azul y verde como en la plantilla del panel.
import { useState, type ReactNode } from 'react';
import { Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MetricsKpis, MetricsPregunta, SurveyKpi } from '@/types';
import { formatearKpi, motivoKpiOculto } from '@/lib/metrics/metricsRules';
import { useDeleteKpi, useKpiDefinitions } from '@/hooks/useMetrics';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { KpiEditorDialog } from './KpiEditorDialog';
import { StatTile } from './StatTile';

interface KpiCardsProps {
  campaignId: string;
  resultado: MetricsKpis | undefined;
  cargando: boolean;
  preguntas: MetricsPregunta[];
  /** Sólo quien gestiona la encuesta crea, edita o borra indicadores. */
  puedeEditar: boolean;
  /** Tarjetas de resumen que van antes de los indicadores. */
  resumen?: ReactNode;
  /** Cuántas tarjetas de resumen hay: el color de los indicadores sigue la alternancia. */
  cantidadResumen?: number;
}

export function KpiCards({
  campaignId,
  resultado,
  cargando,
  preguntas,
  puedeEditar,
  resumen,
  cantidadResumen = 0,
}: KpiCardsProps) {
  const { data: definiciones = [] } = useKpiDefinitions(campaignId);
  const borrar = useDeleteKpi();
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [editando, setEditando] = useState<SurveyKpi | null>(null);
  const [aBorrar, setABorrar] = useState<SurveyKpi | null>(null);

  const abrir = (kpi: SurveyKpi | null) => {
    setEditando(kpi);
    setEditorAbierto(true);
  };

  const kpis = resultado?.kpis ?? [];
  const umbral = resultado?.umbral ?? 5;

  return (
    <section aria-labelledby="titulo-kpis" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-kpis" className="type-h3 flex items-center gap-2 text-primary-900">
          <Gauge className="h-5 w-5 text-primary-500" aria-hidden="true" />
          Indicadores
        </h2>
        {puedeEditar && (
          <Button type="button" size="sm" variant="outline" onClick={() => abrir(null)} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo indicador
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {resumen}
        {cargando && kpis.length === 0
          ? [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-primary-50" />)
          : kpis.map((kpi, i) => {
              const motivo = motivoKpiOculto(kpi, umbral);
              const definicion = definiciones.find((d) => d.id === kpi.id) ?? null;
              const base =
                kpi.formato === 'porcentaje' && !kpi.numerador.suprimido && !kpi.denominador.suprimido
                  ? `${kpi.numerador.conteo} de ${kpi.denominador.conteo} respuestas`
                  : null;
              return (
                <StatTile
                  key={kpi.id}
                  etiqueta={kpi.nombre}
                  valor={formatearKpi(kpi)}
                  acento={(cantidadResumen + i) % 2 === 0 ? 'primary' : 'secondary'}
                  testId="kpi-valor"
                  pie={
                    <>
                      {motivo ?? base}
                      {kpi.descripcion && <span className="mt-1 block text-primary-600">{kpi.descripcion}</span>}
                    </>
                  }
                  acciones={
                    puedeEditar && definicion ? (
                      <>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${kpi.nombre}`} onClick={() => abrir(definicion)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Borrar ${kpi.nombre}`} onClick={() => setABorrar(definicion)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              );
            })}
      </div>
      {!cargando && kpis.length === 0 && (
        <p className="text-sm text-primary-600">
          Todavía no hay indicadores.{puedeEditar ? ' Creá el primero con "Nuevo indicador".' : ''}
        </p>
      )}

      <KpiEditorDialog
        open={editorAbierto}
        onOpenChange={setEditorAbierto}
        campaignId={campaignId}
        preguntas={preguntas}
        kpi={editando}
      />
      <ConfirmDeleteDialog
        open={aBorrar !== null}
        onOpenChange={(abierto) => !abierto && setABorrar(null)}
        title="¿Borrar este indicador?"
        description={`"${aBorrar?.nombre ?? ''}" deja de mostrarse en todas las campañas que lo usan. Las respuestas no se tocan.`}
        onConfirm={async () => {
          if (aBorrar) await borrar.mutateAsync(aBorrar.id);
          setABorrar(null);
        }}
        isLoading={borrar.isPending}
      />
    </section>
  );
}

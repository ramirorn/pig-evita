// ===========================================
// KpiCards — los indicadores del corte, en tarjetas
// ===========================================
import { useState } from 'react';
import { Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MetricsKpis, MetricsPregunta, SurveyKpi } from '@/types';
import { formatearKpi, motivoKpiOculto } from '@/lib/metrics/metricsRules';
import { useDeleteKpi, useKpiDefinitions } from '@/hooks/useMetrics';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { KpiEditorDialog } from './KpiEditorDialog';

interface KpiCardsProps {
  campaignId: string;
  resultado: MetricsKpis | undefined;
  cargando: boolean;
  preguntas: MetricsPregunta[];
  /** Sólo quien gestiona la encuesta crea, edita o borra indicadores. */
  puedeEditar: boolean;
}

export function KpiCards({ campaignId, resultado, cargando, preguntas, puedeEditar }: KpiCardsProps) {
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

      {cargando && kpis.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-32 animate-pulse bg-primary-50" />
          ))}
        </div>
      ) : kpis.length === 0 ? (
        <p className="card p-5 text-sm text-primary-600">
          Todavía no hay indicadores.{puedeEditar ? ' Creá el primero con "Nuevo indicador".' : ''}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const motivo = motivoKpiOculto(kpi, umbral);
            const definicion = definiciones.find((d) => d.id === kpi.id) ?? null;
            return (
              <article key={kpi.id} className="card flex flex-col gap-2 p-5" aria-label={kpi.nombre}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug text-primary-800">{kpi.nombre}</h3>
                  {puedeEditar && definicion && (
                    <div className="-mr-2 -mt-1 flex shrink-0">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${kpi.nombre}`} onClick={() => abrir(definicion)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Borrar ${kpi.nombre}`} onClick={() => setABorrar(definicion)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-3xl font-black tabular-nums text-primary-900" data-testid="kpi-valor">
                  {formatearKpi(kpi)}
                </p>
                {motivo ? (
                  <p className="text-xs text-primary-500">{motivo}</p>
                ) : (
                  kpi.formato === 'porcentaje' &&
                  !kpi.numerador.suprimido &&
                  !kpi.denominador.suprimido && (
                    <p className="text-xs text-primary-500">
                      {kpi.numerador.conteo} de {kpi.denominador.conteo} respuestas
                    </p>
                  )
                )}
                {kpi.descripcion && <p className="text-xs leading-relaxed text-primary-600">{kpi.descripcion}</p>}
              </article>
            );
          })}
        </div>
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

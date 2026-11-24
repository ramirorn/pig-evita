// ===========================================
// HighlightsSection — los destacados del corte, con su ABM
// ===========================================
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { MetricsHighlights, MetricsPregunta, SurveyHighlight } from '@/types';
import { useDeleteHighlight, useHighlightDefinitions } from '@/hooks/useMetrics';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { HighlightCard } from './HighlightCard';
import { HighlightEditorDialog } from './HighlightEditorDialog';

interface HighlightsSectionProps {
  campaignId: string;
  resultado: MetricsHighlights | undefined;
  cargando: boolean;
  preguntas: MetricsPregunta[];
  /** Sólo quien gestiona la encuesta crea, edita o borra destacados. */
  puedeEditar: boolean;
}

export function HighlightsSection({
  campaignId,
  resultado,
  cargando,
  preguntas,
  puedeEditar,
}: HighlightsSectionProps) {
  const { data: definiciones = [] } = useHighlightDefinitions(campaignId);
  const borrar = useDeleteHighlight();
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [editando, setEditando] = useState<SurveyHighlight | null>(null);
  const [aBorrar, setABorrar] = useState<SurveyHighlight | null>(null);

  const abrir = (destacado: SurveyHighlight | null) => {
    setEditando(destacado);
    setEditorAbierto(true);
  };

  const destacados = resultado?.destacados ?? [];

  return (
    <section aria-labelledby="titulo-destacados" className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-destacados" className="type-h3 text-primary-900">Lo más importante</h2>
        {puedeEditar && (
          <Button type="button" size="sm" variant="outline" onClick={() => abrir(null)} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo destacado
          </Button>
        )}
      </div>

      {cargando && destacados.length === 0 ? (
        <div className="card h-64 animate-pulse bg-primary-50" />
      ) : destacados.length === 0 || !resultado ? (
        <p className="card p-5 text-sm text-primary-600">
          Todavía no hay destacados.
          {puedeEditar ? ' Creá uno con "Nuevo destacado" para resumir lo que más eligieron los deportistas.' : ''}
        </p>
      ) : (
        <div className="grid flex-1 gap-3">
          {destacados.map((d) => {
            const definicion = definiciones.find((x) => x.id === d.id) ?? null;
            return (
              <HighlightCard
                key={d.id}
                destacado={d}
                generadoEn={resultado.generadoEn}
                umbral={resultado.umbral}
                minimoFrases={resultado.minimoFrases}
                acciones={
                  puedeEditar && definicion ? (
                    <div className="-mr-2 -mt-1 flex shrink-0">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${d.titulo}`} onClick={() => abrir(definicion)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Borrar ${d.titulo}`} onClick={() => setABorrar(definicion)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}

      <HighlightEditorDialog
        open={editorAbierto}
        onOpenChange={setEditorAbierto}
        campaignId={campaignId}
        preguntas={preguntas}
        destacado={editando}
      />
      <ConfirmDeleteDialog
        open={aBorrar !== null}
        onOpenChange={(abierto) => !abierto && setABorrar(null)}
        title="¿Borrar este destacado?"
        description={`"${aBorrar?.titulo ?? ''}" deja de mostrarse en todas las campañas que lo usan. Las respuestas no se tocan.`}
        onConfirm={async () => {
          if (aBorrar) await borrar.mutateAsync(aBorrar.id);
          setABorrar(null);
        }}
        isLoading={borrar.isPending}
      />
    </section>
  );
}

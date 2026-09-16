// ===========================================
// SurveyQuestionsEditor — el cuestionario (S20)
// ===========================================
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lock,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  useDeleteSurveyQuestion,
  useUpdateSurveyQuestion,
} from '@/hooks/useSurvey';
import { SURVEY_QUESTION_KIND_LABELS } from '@/lib/constants';
import { logError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import {
  SurveyAudience,
  type SurveyCampaignWithQuestions,
  type SurveyQuestionWithOptions,
} from '@/types';
import {
  puedeEditarCuestionario,
  puedeEliminarPregunta,
  type ConteosPorOpcion,
} from './surveyRules';
import { SurveyAudienceBalance } from './SurveyAudienceBalance';
import { SurveyOptionsEditor } from './SurveyOptionsEditor';
import { SurveyQuestionDialog } from './SurveyQuestionDialog';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EmptyState } from '@/components/shared/EmptyState';

/** Clases literales y completas por audiencia (regla D1: nunca interpoladas). */
const ESTILO_AUDIENCIA: Record<SurveyAudience, string> = {
  [SurveyAudience.TODOS]: 'bg-primary-50 text-primary-700 border-primary-200',
  [SurveyAudience.INDIVIDUAL]: 'bg-celeste-50 text-celeste-900 border-celeste-200',
  [SurveyAudience.EQUIPO]: 'bg-secondary-50 text-secondary-700 border-secondary-200',
};

const ETIQUETA_AUDIENCIA: Record<SurveyAudience, string> = {
  [SurveyAudience.TODOS]: 'La ven todos',
  [SurveyAudience.INDIVIDUAL]: 'Sólo deportes individuales',
  [SurveyAudience.EQUIPO]: 'Sólo deportes de equipo',
};

interface SurveyQuestionsEditorProps {
  campaign: SurveyCampaignWithQuestions;
  conteos: ConteosPorOpcion;
}

export function SurveyQuestionsEditor({ campaign, conteos }: SurveyQuestionsEditorProps) {
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [editando, setEditando] = useState<SurveyQuestionWithOptions | undefined>();
  const [eliminando, setEliminando] = useState<SurveyQuestionWithOptions | null>(null);

  const updateMutation = useUpdateSurveyQuestion();
  const deleteMutation = useDeleteSurveyQuestion();

  const edicion = puedeEditarCuestionario(campaign);
  const borrado = puedeEliminarPregunta(campaign);
  const preguntas = [...campaign.questions].sort((a, b) => a.orden - b.orden);

  const siguienteOrden =
    preguntas.length === 0 ? 0 : Math.max(...preguntas.map((p) => p.orden)) + 1;

  /** Intercambia el `orden` con la vecina. Ver el comentario en las opciones. */
  const mover = async (indice: number, direccion: -1 | 1) => {
    const actual = preguntas[indice];
    const vecina = preguntas[indice + direccion];
    if (!actual || !vecina) return;

    try {
      await updateMutation.mutateAsync({
        campaignId: campaign.id,
        questionId: actual.id,
        payload: { orden: vecina.orden },
      });
      await updateMutation.mutateAsync({
        campaignId: campaign.id,
        questionId: vecina.id,
        payload: { orden: actual.orden },
      });
    } catch (error) {
      logError('SurveyQuestionsEditor.mover', error);
    }
  };

  const alternarActiva = async (pregunta: SurveyQuestionWithOptions) => {
    try {
      await updateMutation.mutateAsync({
        campaignId: campaign.id,
        questionId: pregunta.id,
        payload: { activa: !pregunta.activa },
      });
    } catch (error) {
      logError('SurveyQuestionsEditor.alternarActiva', error);
    }
  };

  const confirmarBorrado = async () => {
    if (!eliminando) return;
    try {
      await deleteMutation.mutateAsync({
        campaignId: campaign.id,
        questionId: eliminando.id,
      });
      setEliminando(null);
    } catch (error) {
      logError('SurveyQuestionsEditor.confirmarBorrado', error);
    }
  };

  return (
    <div className="space-y-4">
      {!edicion.permitido && (
        <p className="flex items-start gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm leading-relaxed text-primary-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Este cuestionario es de sólo lectura.</strong>{' '}
            {edicion.motivo}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-primary-900">
          Preguntas{' '}
          <span className="text-sm font-medium text-primary-500">
            ({preguntas.length})
          </span>
        </h2>
        <Button
          className="gap-2"
          disabled={!edicion.permitido}
          title={edicion.motivo}
          onClick={() => {
            setEditando(undefined);
            setDialogoAbierto(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Agregar pregunta
        </Button>
      </div>

      <SurveyAudienceBalance questions={campaign.questions} />

      {preguntas.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="h-10 w-10" />}
          title="El cuestionario está vacío"
          description="Agregá la primera pregunta. Hasta que haya al menos una, la encuesta no se puede publicar."
          action={
            <Button
              className="gap-2"
              disabled={!edicion.permitido}
              title={edicion.motivo}
              onClick={() => {
                setEditando(undefined);
                setDialogoAbierto(true);
              }}
            >
              <Plus className="h-4 w-4" /> Agregar pregunta
            </Button>
          }
        />
      ) : (
        <ol className="space-y-3">
          {preguntas.map((pregunta, indice) => (
            <li
              key={pregunta.id}
              className={cn(
                'rounded-xl border p-4',
                // Una pregunta desactivada se marca con borde y fondo, nunca
                // con `opacity`: bajar la opacidad del bloque entero también
                // baja el contraste del texto y lo saca de AA.
                pregunta.activa
                  ? 'border-primary-100 bg-white'
                  : 'border-dashed border-primary-200 bg-primary-50/50',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 tabular-nums">
                      {indice + 1}
                    </span>
                    <p className="font-semibold text-primary-900">{pregunta.texto}</p>
                  </div>
                  {pregunta.ayuda && (
                    <p className="mt-1 pl-8 text-xs text-primary-500">{pregunta.ayuda}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', ESTILO_AUDIENCIA[pregunta.audiencia])}
                    >
                      {ETIQUETA_AUDIENCIA[pregunta.audiencia]}
                    </Badge>
                    <Badge variant="outline" className="border-primary-200 text-[10px] text-primary-700">
                      {SURVEY_QUESTION_KIND_LABELS[pregunta.kind]}
                    </Badge>
                    {pregunta.obligatoria ? (
                      <Badge variant="outline" className="border-primary-200 text-[10px] text-primary-700">
                        Hay que contestarla
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-primary-200 text-[10px] text-primary-600">
                        Se puede saltear
                      </Badge>
                    )}
                    {!pregunta.activa && (
                      <Badge variant="outline" className="border-accent-300 bg-accent-50 text-[10px] text-accent-800">
                        No se muestra
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!edicion.permitido || indice === 0 || updateMutation.isPending}
                    title={edicion.motivo ?? 'Subir'}
                    onClick={() => void mover(indice, -1)}
                    aria-label={`Subir la pregunta ${indice + 1}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={
                      !edicion.permitido ||
                      indice === preguntas.length - 1 ||
                      updateMutation.isPending
                    }
                    title={edicion.motivo ?? 'Bajar'}
                    onClick={() => void mover(indice, 1)}
                    aria-label={`Bajar la pregunta ${indice + 1}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!edicion.permitido || updateMutation.isPending}
                    title={
                      edicion.motivo ??
                      (pregunta.activa
                        ? 'Sacarla del cuestionario sin borrarla: lo ya contestado se conserva'
                        : 'Volver a mostrarla en el cuestionario')
                    }
                    onClick={() => void alternarActiva(pregunta)}
                    aria-label={
                      pregunta.activa
                        ? `Dejar de mostrar la pregunta ${indice + 1}`
                        : `Volver a mostrar la pregunta ${indice + 1}`
                    }
                  >
                    {pregunta.activa ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-primary-500" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!edicion.permitido}
                    title={edicion.motivo ?? 'Editar la pregunta'}
                    onClick={() => {
                      setEditando(pregunta);
                      setDialogoAbierto(true);
                    }}
                    aria-label={`Editar la pregunta ${indice + 1}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={!borrado.permitido}
                    title={borrado.motivo ?? 'Eliminar la pregunta'}
                    onClick={() => setEliminando(pregunta)}
                    aria-label={`Eliminar la pregunta ${indice + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive-600" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 pl-8">
                <SurveyOptionsEditor
                  campaign={campaign}
                  pregunta={pregunta}
                  conteos={conteos}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      <SurveyQuestionDialog
        open={dialogoAbierto}
        onOpenChange={(abierto) => {
          setDialogoAbierto(abierto);
          if (!abierto) setEditando(undefined);
        }}
        campaignId={campaign.id}
        pregunta={editando}
        ordenSugerido={siguienteOrden}
      />

      <ConfirmDeleteDialog
        isOpen={!!eliminando}
        title="¿Eliminar la pregunta?"
        description={`Se va a eliminar "${eliminando?.texto}" con todas sus opciones.`}
        isLoading={deleteMutation.isPending}
        onConfirm={confirmarBorrado}
        onCancel={() => setEliminando(null)}
      />
    </div>
  );
}

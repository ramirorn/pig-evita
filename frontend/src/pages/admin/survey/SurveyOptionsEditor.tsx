// ===========================================
// SurveyOptionsEditor — las opciones de una pregunta (S20)
// ===========================================
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  useCreateSurveyOption,
  useDeleteSurveyOption,
  useUpdateSurveyOption,
} from '@/hooks/useSurvey';
import { MAX_OPCIONES_POR_PREGUNTA } from '@/schemas';
import type {
  SurveyCampaign,
  SurveyOption,
  SurveyQuestionWithOptions,
} from '@/types';
import { logError } from '@/lib/logger';
import {
  puedeEditarCuestionario,
  puedeEditarValorDeOpcion,
  puedeEliminarOpcion,
  valorUnico,
  valoresDe,
  type ConteosPorOpcion,
} from './surveyRules';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SurveyOptionsEditorProps {
  campaign: Pick<SurveyCampaign, 'id' | 'status' | '_count'>;
  pregunta: SurveyQuestionWithOptions;
  conteos: ConteosPorOpcion;
}

export function SurveyOptionsEditor({
  campaign,
  pregunta,
  conteos,
}: SurveyOptionsEditorProps) {
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState('');
  const [textoNuevo, setTextoNuevo] = useState('');
  const [eliminando, setEliminando] = useState<SurveyOption | null>(null);

  const createMutation = useCreateSurveyOption();
  const updateMutation = useUpdateSurveyOption();
  const deleteMutation = useDeleteSurveyOption();

  const edicion = puedeEditarCuestionario(campaign);
  const valorEditable = puedeEditarValorDeOpcion(campaign);
  const opciones = [...pregunta.options].sort((a, b) => a.orden - b.orden);

  const comun = { campaignId: campaign.id, questionId: pregunta.id };

  const guardarTexto = async (opcion: SurveyOption) => {
    const texto = textoEditado.trim();
    if (!texto || texto === opcion.texto) {
      setEditando(null);
      return;
    }
    try {
      // Se manda **sólo** el texto. Mandar además el `valor` con el mismo
      // contenido sería inofensivo hoy, pero cualquier derivación futura del
      // texto lo renombraría y rompería la serie histórica de las métricas.
      await updateMutation.mutateAsync({ ...comun, optionId: opcion.id, payload: { texto } });
      setEditando(null);
    } catch (error) {
      logError('SurveyOptionsEditor.guardarTexto', error);
    }
  };

  /**
   * Mover una opción intercambia el `orden` con su vecina: son dos PATCH, uno
   * por fila. `orden` no es único en la base (`@@index`, no `@@unique`), así
   * que el estado intermedio —las dos con el mismo número— es válido y no hay
   * que pasar por un valor temporal.
   */
  const mover = async (indice: number, direccion: -1 | 1) => {
    const actual = opciones[indice];
    const vecina = opciones[indice + direccion];
    if (!actual || !vecina) return;

    try {
      await updateMutation.mutateAsync({
        ...comun,
        optionId: actual.id,
        payload: { orden: vecina.orden },
      });
      await updateMutation.mutateAsync({
        ...comun,
        optionId: vecina.id,
        payload: { orden: actual.orden },
      });
    } catch (error) {
      logError('SurveyOptionsEditor.mover', error);
    }
  };

  const agregar = async () => {
    const texto = textoNuevo.trim();
    if (!texto) return;
    try {
      await createMutation.mutateAsync({
        ...comun,
        payload: {
          texto,
          // Mismo criterio que en el alta de la pregunta: el identificador se
          // deriva del texto y nadie lo escribe a mano.
          valor: valorUnico(texto, valoresDe(pregunta)),
          orden: opciones.length === 0 ? 0 : Math.max(...opciones.map((o) => o.orden)) + 1,
        },
      });
      setTextoNuevo('');
    } catch (error) {
      logError('SurveyOptionsEditor.agregar', error);
    }
  };

  const confirmarBorrado = async () => {
    if (!eliminando) return;
    try {
      await deleteMutation.mutateAsync({ ...comun, optionId: eliminando.id });
      setEliminando(null);
    } catch (error) {
      logError('SurveyOptionsEditor.confirmarBorrado', error);
    }
  };

  const guardando = updateMutation.isPending || createMutation.isPending;

  return (
    <div className="space-y-1.5">
      {opciones.length === 0 && (
        <p className="rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-800">
          Esta pregunta todavía no tiene opciones: así no se puede contestar, y
          la encuesta no se va a poder publicar hasta que tenga.
        </p>
      )}

      <ul className="space-y-1.5">
        {opciones.map((opcion, indice) => {
          const borrado = puedeEliminarOpcion(campaign, opcion.id, conteos);
          const enEdicion = editando === opcion.id;

          return (
            <li
              key={opcion.id}
              className="flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-2 py-1.5"
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-primary-400 tabular-nums">
                {indice + 1}
              </span>

              {enEdicion ? (
                <>
                  <Input
                    autoFocus
                    value={textoEditado}
                    onChange={(e) => setTextoEditado(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void guardarTexto(opcion);
                      if (e.key === 'Escape') setEditando(null);
                    }}
                    aria-label={`Texto de la opción ${indice + 1}`}
                    className="h-8 bg-white"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={guardando}
                    onClick={() => void guardarTexto(opcion)}
                    aria-label="Guardar el texto"
                  >
                    {guardando ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-secondary-700" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditando(null)}
                    aria-label="Cancelar la edición"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-primary-900">{opcion.texto}</span>

                  {/*
                    El identificador interno es dato secundario y de sólo
                    lectura: se muestra chiquito y apagado porque es lo que
                    permite que reescribir el texto no rompa los resultados
                    históricos, pero no es algo que Laura tenga que completar.
                  */}
                  <code
                    className="hidden shrink-0 rounded bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] text-primary-500 sm:inline"
                    title={
                      valorEditable.permitido
                        ? 'Identificador interno con el que se agrupan las respuestas. Se arma solo a partir del texto.'
                        : `Identificador interno: ${valorEditable.motivo}`
                    }
                  >
                    {opcion.valor}
                  </code>

                  <div className="flex shrink-0 items-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!edicion.permitido || indice === 0 || guardando}
                      title={edicion.motivo ?? 'Subir'}
                      onClick={() => void mover(indice, -1)}
                      aria-label={`Subir la opción ${indice + 1}`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!edicion.permitido || indice === opciones.length - 1 || guardando}
                      title={edicion.motivo ?? 'Bajar'}
                      onClick={() => void mover(indice, 1)}
                      aria-label={`Bajar la opción ${indice + 1}`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!edicion.permitido}
                      // El texto se puede reescribir SIEMPRE mientras la
                      // campaña no esté cerrada, incluso con respuestas
                      // cargadas: es la mitad tranquilizadora de la regla.
                      title={edicion.motivo ?? 'Reescribir el texto (no afecta los resultados ya cargados)'}
                      onClick={() => {
                        setEditando(opcion.id);
                        setTextoEditado(opcion.texto);
                      }}
                      aria-label={`Editar la opción ${indice + 1}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!borrado.permitido}
                      title={borrado.motivo ?? 'Eliminar la opción'}
                      onClick={() => setEliminando(opcion)}
                      aria-label={`Eliminar la opción ${indice + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive-600" />
                    </Button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {edicion.permitido && (
        <div className="flex items-center gap-2 pl-7">
          <Input
            value={textoNuevo}
            onChange={(e) => setTextoNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void agregar();
              }
            }}
            placeholder="Escribí otra opción y apretá Enter"
            aria-label={`Nueva opción para "${pregunta.texto}"`}
            className="h-8 bg-white"
            disabled={opciones.length >= MAX_OPCIONES_POR_PREGUNTA}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={
              !textoNuevo.trim() ||
              createMutation.isPending ||
              opciones.length >= MAX_OPCIONES_POR_PREGUNTA
            }
            title={
              opciones.length >= MAX_OPCIONES_POR_PREGUNTA
                ? `Más de ${MAX_OPCIONES_POR_PREGUNTA} opciones no se leen en un celular.`
                : undefined
            }
            onClick={() => void agregar()}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        isOpen={!!eliminando}
        title="¿Eliminar la opción?"
        description={`Se va a quitar "${eliminando?.texto}" de las opciones de esta pregunta.`}
        isLoading={deleteMutation.isPending}
        onConfirm={confirmarBorrado}
        onCancel={() => setEliminando(null)}
      />
    </div>
  );
}

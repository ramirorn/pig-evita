// ===========================================
// SurveyQuestionDialog — alta y edición de una pregunta (S20)
// ===========================================
import { useEffect } from 'react';
import {
  useFieldArray,
  useForm,
  type Control,
  type Resolver,
  type SubmitHandler,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';

import {
  surveyQuestionSchema,
  surveyQuestionWithOptionsSchema,
  MAX_OPCIONES_POR_PREGUNTA,
  type SurveyQuestionFormValues,
  type SurveyQuestionWithOptionsFormValues,
} from '@/schemas';
import {
  SurveyAudience,
  SurveyQuestionKind,
  type SurveyQuestionWithOptions,
} from '@/types';
import {
  useCreateSurveyQuestion,
  useUpdateSurveyQuestion,
} from '@/hooks/useSurvey';
import { valorUnico } from './surveyRules';
import { SurveyQuestionFields } from './SurveyQuestionFields';

import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Los campos de una pregunta son los mismos en el alta y en la edición, pero
 * los dos formularios tienen distinto tipo de valores: el de alta lleva además
 * `opciones`. `SurveyQuestionFields` se escribe una sola vez, contra el tipo
 * más chico, y el de alta le pasa su `control` con este cast.
 *
 * Es seguro en la dirección en la que se usa: `SurveyQuestionWithOptionsFormValues`
 * tiene todos los campos de `SurveyQuestionFormValues` con los mismos tipos, y
 * el componente sólo lee los nombres que declara. El cast hace falta porque los
 * genéricos de RHF son invariantes, no porque falte un campo.
 */
function comoControlBase(
  control: Control<SurveyQuestionWithOptionsFormValues>,
): Control<SurveyQuestionFormValues> {
  return control as unknown as Control<SurveyQuestionFormValues>;
}

/** Saca el mensaje de un error de RHF sin asumir su forma exacta. */
function mensajeDeError(valor: unknown): string | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined;
  const error = valor as { message?: unknown; root?: { message?: unknown } };
  if (typeof error.message === 'string') return error.message;
  if (typeof error.root?.message === 'string') return error.root.message;
  return undefined;
}

const VALORES_NUEVOS: SurveyQuestionWithOptionsFormValues = {
  texto: '',
  ayuda: '',
  kind: SurveyQuestionKind.UNICA,
  audiencia: SurveyAudience.TODOS,
  obligatoria: true,
  activa: true,
  opciones: [{ texto: '' }, { texto: '' }],
};

interface SurveyQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  /** Presente = se está editando; ausente = alta. */
  pregunta?: SurveyQuestionWithOptions;
  /** Orden que le toca a una pregunta nueva (el que sigue al último). */
  ordenSugerido: number;
}

export function SurveyQuestionDialog({
  open,
  onOpenChange,
  campaignId,
  pregunta,
  ordenSugerido,
}: SurveyQuestionDialogProps) {
  const esEdicion = Boolean(pregunta);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{esEdicion ? 'Editar la pregunta' : 'Nueva pregunta'}</DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Podés reescribir el texto cuando quieras: los resultados ya recolectados no se pierden.'
              : 'Escribí la pregunta y las opciones entre las que va a poder elegir.'}
          </DialogDescription>
        </DialogHeader>

        {pregunta ? (
          <FormularioEdicion
            campaignId={campaignId}
            pregunta={pregunta}
            onListo={() => onOpenChange(false)}
          />
        ) : (
          <FormularioAlta
            campaignId={campaignId}
            ordenSugerido={ordenSugerido}
            onListo={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// Alta: la pregunta y sus opciones, en un solo envío
// ===========================================

function FormularioAlta({
  campaignId,
  ordenSugerido,
  onListo,
}: {
  campaignId: string;
  ordenSugerido: number;
  onListo: () => void;
}) {
  const createMutation = useCreateSurveyQuestion();

  const form = useForm<SurveyQuestionWithOptionsFormValues>({
    resolver: zodResolver(
      surveyQuestionWithOptionsSchema,
    ) as Resolver<SurveyQuestionWithOptionsFormValues>,
    defaultValues: VALORES_NUEVOS,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'opciones',
  });

  // Zod pone el error del array entero en `opciones` (mínimo/máximo) o en
  // `opciones.root` (el `.refine` de textos repetidos), según de dónde salga, y
  // el tipo que expone RHF para un `useFieldArray` no distingue los dos casos.
  // Se lee defensivamente en vez de afirmar una forma: acá lo peor que puede
  // pasar es no mostrar el mensaje, no romper el formulario.
  const errorDeOpciones = mensajeDeError(form.formState.errors.opciones);

  const submit: SubmitHandler<SurveyQuestionWithOptionsFormValues> = async (values) => {
    // El identificador interno de cada opción se deriva del texto acá y no se
    // le pide a nadie: Laura escribe "No sé qué es" y el backend recibe
    // `no_se_que_es`. Se acumulan los ya usados porque el backend tiene
    // `@@unique([questionId, valor])` y "Sí"/"Si" slugifican igual.
    const usados: string[] = [];
    const opciones = values.opciones.map((opcion, indice) => {
      const valor = valorUnico(opcion.texto, usados);
      usados.push(valor);
      return { texto: opcion.texto.trim(), valor, orden: indice };
    });

    try {
      await createMutation.mutateAsync({
        campaignId,
        payload: {
          texto: values.texto.trim(),
          ayuda: values.ayuda?.trim() || undefined,
          kind: values.kind,
          audiencia: values.audiencia,
          obligatoria: values.obligatoria,
          activa: true,
          orden: ordenSugerido,
          opciones,
        },
      });
      form.reset(VALORES_NUEVOS);
      onListo();
    } catch {
      // El toast lo emite el `onError` del hook.
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <SurveyQuestionFields control={comoControlBase(form.control)} mostrarActiva={false} />

        <fieldset className="space-y-2 rounded-lg border border-primary-100 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-primary-900">
            Opciones para elegir
          </legend>

          {fields.map((campo, indice) => (
            <div key={campo.id} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-primary-300" aria-hidden="true" />
              <Input
                className="bg-white"
                placeholder={`Opción ${indice + 1}`}
                aria-label={`Opción ${indice + 1}`}
                {...form.register(`opciones.${indice}.texto`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                // Con dos opciones el botón se apaga en vez de desaparecer: una
                // pregunta de una sola opción no se puede contestar, y quien la
                // está armando merece saber por qué no puede sacar esa fila.
                disabled={fields.length <= 2}
                title={
                  fields.length <= 2
                    ? 'Una pregunta necesita al menos dos opciones para poder contestarse.'
                    : `Quitar la opción ${indice + 1}`
                }
                onClick={() => remove(indice)}
                aria-label={`Quitar la opción ${indice + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive-600" />
              </Button>
            </div>
          ))}

          {/* Los errores del array entero (mínimo, máximo, repetidas) no cuelgan
              de ninguna fila, así que no hay `FormField` que los muestre: van
              acá, con el mismo estilo que un `FormMessage`. */}
          {errorDeOpciones && (
            <p className="text-sm text-destructive" role="alert">
              {errorDeOpciones}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={fields.length >= MAX_OPCIONES_POR_PREGUNTA}
            title={
              fields.length >= MAX_OPCIONES_POR_PREGUNTA
                ? `Más de ${MAX_OPCIONES_POR_PREGUNTA} opciones no se leen en un celular.`
                : undefined
            }
            onClick={() => append({ texto: '' })}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar opción
          </Button>
        </fieldset>

        <div className="flex justify-end gap-3 border-t border-primary-100 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onListo}
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Agregar pregunta
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ===========================================
// Edición: sólo los campos de la pregunta
// ===========================================

function FormularioEdicion({
  campaignId,
  pregunta,
  onListo,
}: {
  campaignId: string;
  pregunta: SurveyQuestionWithOptions;
  onListo: () => void;
}) {
  const updateMutation = useUpdateSurveyQuestion();

  const form = useForm<SurveyQuestionFormValues>({
    resolver: zodResolver(surveyQuestionSchema) as Resolver<SurveyQuestionFormValues>,
    defaultValues: {
      texto: pregunta.texto,
      ayuda: pregunta.ayuda ?? '',
      kind: pregunta.kind,
      audiencia: pregunta.audiencia,
      obligatoria: pregunta.obligatoria,
      activa: pregunta.activa,
    },
  });

  useEffect(() => {
    form.reset({
      texto: pregunta.texto,
      ayuda: pregunta.ayuda ?? '',
      kind: pregunta.kind,
      audiencia: pregunta.audiencia,
      obligatoria: pregunta.obligatoria,
      activa: pregunta.activa,
    });
  }, [pregunta, form]);

  const submit: SubmitHandler<SurveyQuestionFormValues> = async (values) => {
    try {
      await updateMutation.mutateAsync({
        campaignId,
        questionId: pregunta.id,
        payload: {
          texto: values.texto.trim(),
          ayuda: values.ayuda?.trim() || undefined,
          kind: values.kind,
          audiencia: values.audiencia,
          obligatoria: values.obligatoria,
          activa: values.activa,
        },
      });
      onListo();
    } catch {
      // El toast lo emite el `onError` del hook.
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <SurveyQuestionFields control={form.control} mostrarActiva />

        <p className="rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs leading-relaxed text-primary-700">
          Las opciones de respuesta se editan en la lista, debajo de la
          pregunta: así se puede cambiar una sola sin tocar las demás.
        </p>

        <div className="flex justify-end gap-3 border-t border-primary-100 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onListo}
            disabled={updateMutation.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </Form>
  );
}

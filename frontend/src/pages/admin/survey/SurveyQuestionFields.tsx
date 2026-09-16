// ===========================================
// SurveyQuestionFields — los campos de una pregunta (S20)
// ===========================================
//
// Los comparten el alta y la edición. El alta agrega arriba las opciones, que
// en la edición no están: `PATCH .../questions/:id` no las acepta (cada opción
// tiene su endpoint) y por eso el formulario de edición tampoco las tiene.

import type { Control } from 'react-hook-form';
import type { SurveyQuestionFormValues } from '@/schemas';
import { SurveyAudience, SurveyQuestionKind } from '@/types';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Nada de "UNICA"/"MULTIPLE" en pantalla: eso es el nombre del enum, no el
 * nombre de la cosa. Lo que Laura decide es cuántas opciones puede marcar un
 * chico.
 */
const KIND_OPCIONES: { valor: SurveyQuestionKind; etiqueta: string; ayuda: string }[] = [
  {
    valor: SurveyQuestionKind.UNICA,
    etiqueta: 'Una sola respuesta',
    ayuda: 'Puede marcar una opción. Si marca otra, se le desmarca la anterior.',
  },
  {
    valor: SurveyQuestionKind.MULTIPLE,
    etiqueta: 'Varias respuestas',
    ayuda: 'Puede marcar todas las opciones que quiera.',
  },
];

/**
 * La audiencia es el mecanismo por el que el mismo cuestionario se adapta al
 * deporte de cada chico, y es lo menos evidente de toda la pantalla: por eso
 * cada opción trae su explicación en una línea, y no sólo la etiqueta.
 */
const AUDIENCIA_OPCIONES: { valor: SurveyAudience; etiqueta: string; ayuda: string }[] = [
  {
    valor: SurveyAudience.TODOS,
    etiqueta: 'Todos',
    ayuda: 'La ven todos los que contestan, sea cual sea su deporte.',
  },
  {
    valor: SurveyAudience.INDIVIDUAL,
    etiqueta: 'Sólo deportes individuales',
    ayuda: 'La ven sólo quienes compiten en un deporte individual (atletismo, natación, ajedrez...).',
  },
  {
    valor: SurveyAudience.EQUIPO,
    etiqueta: 'Sólo deportes de equipo',
    ayuda: 'La ven sólo quienes compiten en un deporte de equipo (fútbol, vóley, handball...).',
  },
];

interface SurveyQuestionFieldsProps {
  control: Control<SurveyQuestionFormValues>;
  /** En el alta no tiene sentido ofrecer "desactivada": se crearía muerta. */
  mostrarActiva: boolean;
}

export function SurveyQuestionFields({ control, mostrarActiva }: SurveyQuestionFieldsProps) {
  return (
    <>
      <FormField
        control={control}
        name="texto"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-primary-900">
              La pregunta *
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Ej. Cuando algo del deporte te preocupa, ¿tenés con quién hablarlo?"
                className="resize-none bg-white font-medium"
                rows={2}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="ayuda"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-semibold text-primary-900">
              Aclaración (opcional)
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Una línea corta debajo de la pregunta, si hace falta"
                className="bg-white"
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">
                ¿Cuántas opciones puede marcar?
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {KIND_OPCIONES.map((opcion) => (
                    <SelectItem key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-primary-500">
                {KIND_OPCIONES.find((o) => o.valor === field.value)?.ayuda}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="audiencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">
                ¿Quiénes la ven?
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {AUDIENCIA_OPCIONES.map((opcion) => (
                    <SelectItem key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-primary-500">
                {AUDIENCIA_OPCIONES.find((o) => o.valor === field.value)?.ayuda}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="obligatoria"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-primary-100 bg-primary-50/40 p-3">
            <FormControl>
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </FormControl>
            <div className="space-y-0.5">
              <FormLabel className="cursor-pointer text-sm font-semibold text-primary-900">
                Hay que contestarla para poder enviar
              </FormLabel>
              <FormDescription className="text-xs text-primary-500">
                Si la destildás, quien responde puede saltearla.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      {mostrarActiva && (
        <FormField
          control={control}
          name="activa"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-primary-100 bg-primary-50/40 p-3">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="cursor-pointer text-sm font-semibold text-primary-900">
                  Se muestra en el cuestionario
                </FormLabel>
                <FormDescription className="text-xs text-primary-500">
                  Destildala para sacarla del cuestionario sin borrarla: lo que
                  ya contestaron sigue contando en los resultados.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      )}
    </>
  );
}

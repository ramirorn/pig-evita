// ===========================================
// SurveyCampaignForm — datos de la campaña (S20)
// ===========================================
import { Loader2 } from 'lucide-react';
import type { SurveyCampaign } from '@/types';
import { CompetitionStage, SurveyWindow } from '@/types';
import { STAGE_LABELS, SURVEY_WINDOW_LABELS } from '@/lib/constants';
import { SURVEY_ETAPA_CUALQUIERA } from '@/schemas';
import { useSurveyCampaignForm } from './useSurveyCampaignForm';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SurveyCampaignFormProps {
  initialData?: SurveyCampaign;
  onSuccess?: (campaign: SurveyCampaign) => void;
  onCancel?: () => void;
}

/**
 * Los datos de la campaña, sin el cuestionario: eso se edita en la pantalla
 * propia, porque redactar preguntas no entra en un modal.
 *
 * Acá no hay ningún campo de estado. Publicar y cerrar son decisiones con
 * consecuencias (empieza o deja de recibir respuestas de chicos) y tienen su
 * botón en el editor, con su confirmación. Un `<select>` de estado perdido
 * entre "Título" y "Año" las volvería un cambio al pasar.
 */
export function SurveyCampaignForm({
  initialData,
  onSuccess,
  onCancel,
}: SurveyCampaignFormProps) {
  const { form, submit, isPending, isEditing } = useSurveyCampaignForm({
    initialData,
    onSuccess,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold uppercase tracking-wider text-primary-900">
                Nombre de la encuesta *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej. Cómo la estás pasando — Etapa Zonal 2026"
                  className="bg-white font-medium"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs text-primary-500">
                Es el título que van a ver los chicos arriba del cuestionario.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="anio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Año de la edición *
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    className="bg-white"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      // El input entrega texto: sin esta conversión el schema
                      // recibe un string y el mensaje de error habla de tipos.
                      field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ventana"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  ¿Cuándo se contesta? *
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Elegí el momento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(SurveyWindow).map((ventana) => (
                      <SelectItem key={ventana} value={ventana}>
                        {SURVEY_WINDOW_LABELS[ventana]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="etapa"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">
                Etapa de la competencia
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={SURVEY_ETAPA_CUALQUIERA}>
                    Cualquier etapa
                  </SelectItem>
                  {Object.values(CompetitionStage).map((etapa) => (
                    <SelectItem key={etapa} value={etapa}>
                      {STAGE_LABELS[etapa]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs text-primary-500">
                Si elegís una etapa, la encuesta sólo se les ofrece a quienes
                están compitiendo en ésa. Con "cualquier etapa", a todos, y la
                etapa se la preguntamos a quien responde.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="abreEn"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Se abre el
                </FormLabel>
                <FormControl>
                  <Input type="date" className="bg-white" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cierraEn"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Se cierra el
                </FormLabel>
                <FormControl>
                  <Input type="date" className="bg-white" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription className="text-xs text-primary-500">
                  Se puede contestar todo ese día. Si dejás las dos fechas
                  vacías, la encuesta recibe respuestas desde que la publicás
                  hasta que la cerrás a mano.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">
                Nota interna
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Para qué es esta campaña, con quién se coordinó, qué se quiere mirar..."
                  className="resize-none bg-white"
                  rows={2}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 border-t border-primary-100 pt-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear y escribir las preguntas'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

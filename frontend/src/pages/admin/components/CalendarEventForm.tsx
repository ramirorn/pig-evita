// ===========================================
// Calendar Event Form Component
// ===========================================
import type { CalendarEvent } from '@/types';
import { useCalendarEventForm } from './calendar-event/useCalendarEventForm';
import { EventScheduleFields } from './calendar-event/EventScheduleFields';
import { EventClassificationFields } from './calendar-event/EventClassificationFields';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface CalendarEventFormProps {
  initialData?: CalendarEvent;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Formulario de alta/edición de eventos del calendario.
 *
 * Sólo arma el layout: la lógica vive en `useCalendarEventForm` y los dos
 * bloques con identidad propia (horario y clasificación) son componentes
 * aparte. Lo que queda acá son los campos sueltos que no forman grupo.
 */
export function CalendarEventForm({ initialData, onSuccess, onCancel }: CalendarEventFormProps) {
  const { form, submit, isPending, isEditing } = useCalendarEventForm({ initialData, onSuccess });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {/* Título */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 uppercase tracking-wider">
                Título del Evento *
              </FormLabel>
              <FormControl>
                <Input placeholder="Ej. Torneo Zonal de Vóley Masculino Sub-16" className="bg-white font-medium" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <EventScheduleFields form={form} />

        <EventClassificationFields form={form} />

        {/* Descripción */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">Descripción o Detalles Adicionales</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Información sobre acreditación, requisitos, cronograma..."
                  className="resize-none bg-white"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Estado de Publicación */}
        <FormField
          control={form.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-primary-100 p-3 bg-primary-50/40">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-semibold text-primary-900 cursor-pointer">
                  Publicar evento
                </FormLabel>
                <FormDescription className="text-xs text-primary-500">
                  Si está activo, el evento será visible en el calendario público para deportistas y público general.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-3 border-t border-primary-100">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Evento'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

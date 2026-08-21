// ===========================================
// useCalendarEventForm — estado y envío del formulario de eventos
// ===========================================
import { useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type * as z from 'zod';
import { calendarEventSchema } from '@/schemas';
import type { CalendarEvent } from '@/types';
import { CompetitionStage } from '@/types';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '@/hooks/useCalendar';

export type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

/**
 * Tipo del objeto de RHF que se pasa a las secciones de campos.
 *
 * Va como un único prop `form` en lugar de desarmarlo en `control`, `watch`,
 * `setValue`, ... : las secciones necesitan casi toda la API del formulario
 * (los atajos de hora escriben con `setValue` leyendo con `getValues`), así que
 * enumerarlas sería una lista de props que crece con cada atajo nuevo.
 */
export type CalendarEventFormApi = UseFormReturn<CalendarEventFormValues>;

/** Parte un ISO del backend en los dos campos separados que muestra el form. */
function splitIso(iso?: string | null, defaultTime = '09:00'): { date: string; time: string } {
  if (!iso) return { date: '', time: defaultTime };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: defaultTime };
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

/** Valores iniciales del form a partir del evento que se está editando (o vacío). */
function buildDefaultValues(initialData?: CalendarEvent): CalendarEventFormValues {
  const start = splitIso(initialData?.startDate, '09:00');
  const end = splitIso(initialData?.endDate, '11:00');

  return {
    title: initialData?.title || '',
    description: initialData?.description || '',
    // `toISOString()` siempre tiene la forma "YYYY-MM-DDTHH:mm:ss.sssZ", así que
    // los primeros 10 caracteres son la fecha: `slice` evita el acceso indexado
    // (y su `| undefined`) sin necesidad de afirmar nada.
    startDate: start.date || new Date().toISOString().slice(0, 10),
    startTime: start.time || '09:00',
    hasEndDate: Boolean(initialData?.endDate),
    endDate: end.date || '',
    endTime: end.time || '11:00',
    stage: (initialData?.stage as CompetitionStage) || undefined,
    disciplineId: initialData?.disciplineId || '',
    venueId: initialData?.venueId || '',
    isPublished: initialData ? initialData.isPublished : true,
  };
}

interface UseCalendarEventFormOptions {
  initialData?: CalendarEvent;
  onSuccess?: () => void;
}

/**
 * Concentra todo lo que el formulario de eventos *hace*: valores por defecto,
 * resincronización al cambiar de evento y la traducción de los campos separados
 * de fecha/hora al ISO que espera el backend. Las secciones de campos quedan así
 * puramente declarativas.
 */
export function useCalendarEventForm({ initialData, onSuccess }: UseCalendarEventFormOptions) {
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  const form = useForm<CalendarEventFormValues>({
    // El schema tiene `.default()`, así que los tipos de entrada y salida de Zod
    // difieren. RHF sólo lo modela con tres genéricos y `FormField` (shadcn)
    // expone dos: el cast queda acotado acá en vez de repetirse en cada campo.
    resolver: zodResolver(calendarEventSchema) as Resolver<CalendarEventFormValues>,
    defaultValues: buildDefaultValues(initialData),
  });

  useEffect(() => {
    form.reset(buildDefaultValues(initialData));
  }, [initialData, form]);

  const submit: SubmitHandler<CalendarEventFormValues> = async (values) => {
    try {
      const startIso = new Date(`${values.startDate}T${values.startTime || '00:00'}:00`).toISOString();
      const endIso =
        values.hasEndDate && values.endDate
          ? new Date(`${values.endDate}T${values.endTime || '23:59'}:00`).toISOString()
          : null;

      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        startDate: startIso,
        endDate: endIso,
        stage: values.stage ? (values.stage as CompetitionStage) : null,
        disciplineId: values.disciplineId && values.disciplineId !== 'none' ? values.disciplineId : null,
        venueId: values.venueId && values.venueId !== 'none' ? values.venueId : null,
        isPublished: values.isPublished,
      };

      if (initialData?.id) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch {
      // El error ya se notifica en el `onError` de React Query.
    }
  };

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing: Boolean(initialData?.id),
  };
}

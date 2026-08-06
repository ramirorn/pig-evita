// ===========================================
// Calendar Event Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { calendarEventSchema } from '@/schemas';
import type { CalendarEvent } from '@/types';
import { CompetitionStage } from '@/types';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '@/hooks/useCalendar';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useVenues } from '@/hooks/useVenues';
import { STAGE_LABELS } from '@/lib/constants';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

interface CalendarEventFormProps {
  initialData?: CalendarEvent;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function formatDateForInput(isoDate?: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function CalendarEventForm({ initialData, onSuccess, onCancel }: CalendarEventFormProps) {
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  const { data: disciplinesData } = useDisciplines({ isActive: true });
  const { data: venuesData } = useVenues({ isActive: true });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventSchema) as any,
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      startDate: formatDateForInput(initialData?.startDate) || '',
      endDate: formatDateForInput(initialData?.endDate) || '',
      stage: (initialData?.stage as CompetitionStage) || undefined,
      disciplineId: initialData?.disciplineId || '',
      venueId: initialData?.venueId || '',
      isPublished: initialData ? initialData.isPublished : true,
    },
  });

  useEffect(() => {
    form.reset({
      title: initialData?.title || '',
      description: initialData?.description || '',
      startDate: formatDateForInput(initialData?.startDate) || '',
      endDate: formatDateForInput(initialData?.endDate) || '',
      stage: (initialData?.stage as CompetitionStage) || undefined,
      disciplineId: initialData?.disciplineId || '',
      venueId: initialData?.venueId || '',
      isPublished: initialData ? initialData.isPublished : true,
    });
  }, [initialData, form]);

  const onSubmit = async (values: CalendarEventFormValues) => {
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
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
      // Handled in React Query onError
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Título */}
        <FormField
          control={form.control as any}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título del Evento *</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Torneo Zonal de Vóley Masculino" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fechas de Inicio y Fin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha y Hora de Inicio *</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha y Hora de Fin (Opcional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Etapa, Disciplina y Sede */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control as any}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa (Opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === 'none' ? undefined : val)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Sin etapa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin etapa específica</SelectItem>
                    {Object.entries(STAGE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="disciplineId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disciplina (Opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Todas / General" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">General / Sin disciplina</SelectItem>
                    {(disciplinesData?.data || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="venueId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sede (Opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Sin sede asignada" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin sede asignada</SelectItem>
                    {(venuesData?.data || []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.locality})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Descripción */}
        <FormField
          control={form.control as any}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción o Detalles Adicionales</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Información sobre acreditación, requisitos, cronograma..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Estado de Publicación */}
        <FormField
          control={form.control as any}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 space-y-0 rounded-md border p-3 bg-primary-50/50">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </FormControl>
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium text-primary-900 cursor-pointer">
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
        <div className="flex justify-end gap-3 pt-4 border-t border-primary-100">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {initialData?.id ? 'Guardar Cambios' : 'Crear Evento'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

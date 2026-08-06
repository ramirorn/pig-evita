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
import { ClockTimePicker } from '@/components/ui/clock-time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Loader2, Sparkles } from 'lucide-react';

type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

interface CalendarEventFormProps {
  initialData?: CalendarEvent;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function splitIso(iso?: string | null, defaultTime = '09:00'): { date: string; time: string } {
  if (!iso) return { date: '', time: defaultTime };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: defaultTime };
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function formatHumanReadableRange(
  startDate: string,
  startTime: string,
  hasEndDate: boolean,
  endDate?: string | null,
  endTime?: string | null
): string {
  if (!startDate) return '';
  try {
    const startObj = new Date(`${startDate}T${startTime || '00:00'}:00`);
    if (isNaN(startObj.getTime())) return '';

    const dateStr = startObj.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    const timeStr = `${startTime || '00:00'} hs`;

    if (!hasEndDate || !endDate) {
      return `Programado: ${capDate} a las ${timeStr}`;
    }

    const endObj = new Date(`${endDate}T${endTime || '23:59'}:00`);
    if (isNaN(endObj.getTime())) return `Programado: ${capDate} a las ${timeStr}`;

    const isSameDay = startDate === endDate;
    if (isSameDay) {
      return `Programado: ${capDate} de ${timeStr} a ${endTime || '23:59'} hs`;
    }

    const endDateStr = endObj.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `Programado: Del ${capDate} (${timeStr}) al ${endDateStr} (${endTime || '23:59'} hs)`;
  } catch {
    return '';
  }
}

const COMMON_START_HOURS = ['08:00', '09:00', '10:00', '11:00', '14:00', '16:00', '18:00', '19:00', '20:00'];

export function CalendarEventForm({ initialData, onSuccess, onCancel }: CalendarEventFormProps) {
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();

  const { data: disciplinesData } = useDisciplines({ isActive: true });
  const { data: venuesData } = useVenues({ isActive: true });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const startInitial = splitIso(initialData?.startDate, '09:00');
  const endInitial = splitIso(initialData?.endDate, '11:00');
  const hasEndInitial = Boolean(initialData?.endDate);

  const form = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventSchema) as any,
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      startDate: startInitial.date || new Date().toISOString().split('T')[0],
      startTime: startInitial.time || '09:00',
      hasEndDate: hasEndInitial,
      endDate: endInitial.date || '',
      endTime: endInitial.time || '11:00',
      stage: (initialData?.stage as CompetitionStage) || undefined,
      disciplineId: initialData?.disciplineId || '',
      venueId: initialData?.venueId || '',
      isPublished: initialData ? initialData.isPublished : true,
    },
  });

  useEffect(() => {
    const sInit = splitIso(initialData?.startDate, '09:00');
    const eInit = splitIso(initialData?.endDate, '11:00');
    form.reset({
      title: initialData?.title || '',
      description: initialData?.description || '',
      startDate: sInit.date || new Date().toISOString().split('T')[0],
      startTime: sInit.time || '09:00',
      hasEndDate: Boolean(initialData?.endDate),
      endDate: eInit.date || '',
      endTime: eInit.time || '11:00',
      stage: (initialData?.stage as CompetitionStage) || undefined,
      disciplineId: initialData?.disciplineId || '',
      venueId: initialData?.venueId || '',
      isPublished: initialData ? initialData.isPublished : true,
    });
  }, [initialData, form]);

  const watchStartDate = form.watch('startDate');
  const watchStartTime = form.watch('startTime');
  const watchHasEndDate = form.watch('hasEndDate');
  const watchEndDate = form.watch('endDate');
  const watchEndTime = form.watch('endTime');

  const previewText = formatHumanReadableRange(
    watchStartDate,
    watchStartTime,
    watchHasEndDate,
    watchEndDate,
    watchEndTime
  );

  const onSubmit = async (values: CalendarEventFormValues) => {
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

        {/* Sección: Fecha y Horario */}
        <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-primary-900 font-bold text-xs uppercase tracking-wider">
            <CalendarIcon className="w-4 h-4 text-primary-600" />
            <span>Fecha y Horario del Evento</span>
          </div>

          {/* Fila Fecha y Hora de Inicio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <FormField
              control={form.control as any}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-primary-800">Fecha de Inicio *</FormLabel>
                  <FormControl>
                    <Input type="date" className="bg-white h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-primary-800">Hora de Inicio *</FormLabel>
                  <FormControl>
                    <ClockTimePicker
                      value={field.value}
                      onChange={(time) => field.onChange(time)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Atajos rápidos de hora alineados en una sola fila prolija */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[11px] font-medium text-primary-500 mr-1">Atajos de hora:</span>
            {COMMON_START_HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() => form.setValue('startTime', hour)}
                className={`text-xs px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  watchStartTime === hour
                    ? 'bg-primary-600 text-white border-primary-600 font-semibold shadow-xs'
                    : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-100 hover:border-primary-300'
                }`}
              >
                {hour}
              </button>
            ))}
          </div>

          {/* Toggle Fecha/Hora de Fin */}
          <div className="pt-3 border-t border-primary-200/60 space-y-3">
            <FormField
              control={form.control as any}
              name="hasEndDate"
              render={({ field }) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked);
                      if (e.target.checked && !form.getValues('endDate')) {
                        form.setValue('endDate', form.getValues('startDate') || '');
                        const currentStart = form.getValues('startTime') || '09:00';
                        const [h, m] = currentStart.split(':').map(Number);
                        const endH = Math.min(23, (h + 2) % 24).toString().padStart(2, '0');
                        form.setValue('endTime', `${endH}:${(m || 0).toString().padStart(2, '0')}`);
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-primary-900">
                    Definir fecha y hora de finalización (opcional)
                  </span>
                </label>
              )}
            />

            {watchHasEndDate && (
              <div className="bg-white/90 p-3.5 rounded-lg border border-primary-200 space-y-3 animate-in fade-in-50 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <FormField
                    control={form.control as any}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-primary-800">Fecha de Fin</FormLabel>
                        <FormControl>
                          <Input type="date" className="bg-white h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control as any}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-primary-800">Hora de Fin</FormLabel>
                        <FormControl>
                          <ClockTimePicker
                            value={field.value}
                            onChange={(time) => field.onChange(time)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Atajos de duración */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-primary-500 mr-1">Duración rápida:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const start = form.getValues('startTime') || '09:00';
                      const [h, m] = start.split(':').map(Number);
                      const endH = Math.min(23, (h + 1) % 24).toString().padStart(2, '0');
                      form.setValue('endTime', `${endH}:${(m || 0).toString().padStart(2, '0')}`);
                      form.setValue('endDate', form.getValues('startDate'));
                    }}
                    className="text-xs px-2 py-0.5 rounded-md border border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
                  >
                    +1h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const start = form.getValues('startTime') || '09:00';
                      const [h, m] = start.split(':').map(Number);
                      const endH = Math.min(23, (h + 2) % 24).toString().padStart(2, '0');
                      form.setValue('endTime', `${endH}:${(m || 0).toString().padStart(2, '0')}`);
                      form.setValue('endDate', form.getValues('startDate'));
                    }}
                    className="text-xs px-2 py-0.5 rounded-md border border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
                  >
                    +2h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const start = form.getValues('startTime') || '09:00';
                      const [h, m] = start.split(':').map(Number);
                      const endH = Math.min(23, (h + 3) % 24).toString().padStart(2, '0');
                      form.setValue('endTime', `${endH}:${(m || 0).toString().padStart(2, '0')}`);
                      form.setValue('endDate', form.getValues('startDate'));
                    }}
                    className="text-xs px-2 py-0.5 rounded-md border border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
                  >
                    +3h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('endTime', '23:59');
                      form.setValue('endDate', form.getValues('startDate'));
                    }}
                    className="text-xs px-2 py-0.5 rounded-md border border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
                  >
                    Fin del día (23:59)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resumen en vivo */}
          {previewText && (
            <div className="bg-primary-100/70 border border-primary-200 text-primary-900 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-600 shrink-0" />
              <span>{previewText}</span>
            </div>
          )}
        </div>

        {/* Fila: Disciplina y Etapa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control as any}
            name="disciplineId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">Disciplina (Opcional)</FormLabel>
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
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">Etapa (Opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === 'none' ? undefined : val)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Sin etapa específica" />
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
        </div>

        {/* Sede Asignada (Ancho completo para ver nombre y localidad sin truncar) */}
        <FormField
          control={form.control as any}
          name="venueId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">Sede / Ubicación (Opcional)</FormLabel>
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
                      {v.name} — {v.locality} {v.address ? `(${v.address})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Descripción */}
        <FormField
          control={form.control as any}
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
          control={form.control as any}
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
            {initialData?.id ? 'Guardar Cambios' : 'Crear Evento'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ===========================================
// EventScheduleFields — bloque de fecha, hora y duración del evento
// ===========================================
import type { CalendarEventFormApi } from './useCalendarEventForm';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ClockTimePicker } from '@/components/ui/clock-time-picker';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';

const COMMON_START_HOURS = ['08:00', '09:00', '10:00', '11:00', '14:00', '16:00', '18:00', '19:00', '20:00'];

/** Arma el resumen en lenguaje natural que se muestra debajo de los campos. */
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

/**
 * Corre la hora de fin `hours` horas después del inicio y alinea la fecha de fin
 * con la de inicio: es exactamente lo que hacían los tres atajos de duración
 * (+1h, +2h, +3h), que estaban copiados y pegados con el número cambiado.
 */
function shiftEndByHours(form: CalendarEventFormApi, hours: number) {
  const start = form.getValues('startTime') || '09:00';
  // `split(':')` siempre devuelve al menos un elemento, pero el tipo no lo sabe.
  // Además, convertir acá con `|| 0` evita que una hora guardada mal formada
  // propague un NaN hasta el `endTime` que escribimos en el form.
  const [hRaw, mRaw] = start.split(':');
  const h = Number(hRaw) || 0;
  const m = Number(mRaw) || 0;
  const endH = Math.min(23, (h + hours) % 24).toString().padStart(2, '0');
  form.setValue('endTime', `${endH}:${m.toString().padStart(2, '0')}`);
  form.setValue('endDate', form.getValues('startDate'));
}

/**
 * Todo lo relativo a *cuándo* pasa el evento: inicio, atajos de hora, fin
 * opcional con sus atajos de duración y el resumen en vivo. Es el bloque con
 * más interacción del formulario y el único que escribe campos derivados
 * (al tildar "fecha de fin" propone inicio + 2 h), así que se mantiene junto.
 */
export function EventScheduleFields({ form }: { form: CalendarEventFormApi }) {
  const watchStartTime = form.watch('startTime');
  const watchHasEndDate = form.watch('hasEndDate');

  const previewText = formatHumanReadableRange(
    form.watch('startDate'),
    watchStartTime,
    watchHasEndDate,
    form.watch('endDate'),
    form.watch('endTime')
  );

  return (
    <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4 space-y-3.5">
      <div className="flex items-center gap-2 text-primary-900 font-bold text-xs uppercase tracking-wider">
        <CalendarIcon className="w-4 h-4 text-primary-600" />
        <span>Fecha y Horario del Evento</span>
      </div>

      {/* Fila Fecha y Hora de Inicio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <FormField
          control={form.control}
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
          control={form.control}
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
          control={form.control}
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
                    shiftEndByHours(form, 2);
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
                control={form.control}
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
                control={form.control}
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
              {[1, 2, 3].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => shiftEndByHours(form, hours)}
                  className="text-xs px-2 py-0.5 rounded-md border border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
                >
                  +{hours}h
                </button>
              ))}
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
  );
}

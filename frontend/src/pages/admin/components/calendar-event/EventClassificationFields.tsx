// ===========================================
// EventClassificationFields — disciplina, etapa y sede del evento
// ===========================================
import type { CalendarEventFormApi } from './useCalendarEventForm';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useVenues } from '@/hooks/useVenues';
import { STAGE_LABELS } from '@/lib/constants';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Los tres campos opcionales que ubican al evento dentro del torneo. Se agrupan
 * acá porque comparten una misma característica: sus opciones no son literales
 * del formulario sino catálogos remotos (disciplinas y sedes). Al vivir en su
 * propio componente, las queries de catálogo quedan al lado de los `<Select>`
 * que las consumen en vez de colgar del formulario entero.
 */
export function EventClassificationFields({ form }: { form: CalendarEventFormApi }) {
  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplinesData } = useAllDisciplines({ isActive: true });
  const { data: venuesData } = useVenues({ isActive: true });

  return (
    <>
      {/* Fila: Disciplina y Etapa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
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
                  {(disciplinesData ?? []).map((d) => (
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
          control={form.control}
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
        control={form.control}
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
    </>
  );
}

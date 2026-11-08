// ===========================================
// VenueCoordinateFields — panel de coordenadas GPS de la sede
// ===========================================
import type { VenueFormApi } from './useVenueForm';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { NumberField } from '@/components/ui/number-field';
import { Navigation } from 'lucide-react';

/**
 * Latitud y longitud, con su propio panel y encabezado. Se separa del resto del
 * formulario porque es el único bloque opcional con identidad visual propia y
 * con una regla de entrada distinta: son decimales que hay que convertir a
 * `undefined` cuando el input queda vacío, no texto libre.
 */
export function VenueCoordinateFields({ form }: { form: VenueFormApi }) {
  return (
    <div className="p-3 bg-primary-50/60 rounded-lg border border-primary-100 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-800">
        <Navigation className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
        <span>Coordenadas geográficas (opcional)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="latitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-primary-700">Latitud</FormLabel>
              <FormControl>
                <NumberField
                  decimal
                  stepper={false}
                  min={-90}
                  max={90}
                  step={0.0001}
                  placeholder="-26.185"
                  wrapperClassName="bg-white"
                  className="text-xs"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="longitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-primary-700">Longitud</FormLabel>
              <FormControl>
                <NumberField
                  decimal
                  stepper={false}
                  min={-180}
                  max={180}
                  step={0.0001}
                  placeholder="-58.175"
                  wrapperClassName="bg-white"
                  className="text-xs"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="mt-2 text-xs text-primary-600">
        En grados decimales, con signo: en Formosa ambas son negativas (por ejemplo -26.1850 y -58.1750).
      </p>
    </div>
  );
}

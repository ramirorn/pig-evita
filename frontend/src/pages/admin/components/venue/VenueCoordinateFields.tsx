// ===========================================
// VenueCoordinateFields — panel de coordenadas GPS de la sede
// ===========================================
import type { VenueFormApi } from './useVenueForm';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
        <Navigation className="w-3.5 h-3.5 text-primary-600" />
        <span>Coordenadas Geográficas (Opcional)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="latitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[11px] text-primary-700">Latitud</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  placeholder="-26.185"
                  className="bg-white h-9 text-xs"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === '' ? undefined : parseFloat(val));
                  }}
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
              <FormLabel className="text-[11px] text-primary-700">Longitud</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="any"
                  placeholder="-58.175"
                  className="bg-white h-9 text-xs"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === '' ? undefined : parseFloat(val));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// ===========================================
// Venue Form Component
// ===========================================
import type { Venue } from '@/types';
import { useVenueForm } from './venue/useVenueForm';
import { VenueCoordinateFields } from './venue/VenueCoordinateFields';

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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MapPin, Building2, Users, CheckCircle2 } from 'lucide-react';

interface VenueFormProps {
  initialData?: Venue;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const FORMOSA_DEPARTMENTS = [
  'Formosa',
  'Pilcomayo',
  'Pirané',
  'Patiño',
  'Pilagás',
  'Bermejo',
  'Matacos',
  'Ramón Lista',
  'Laishí',
];

/**
 * Formulario de alta/edición de sedes.
 *
 * Sólo arma el layout: la lógica vive en `useVenueForm` y el panel de
 * coordenadas GPS es un componente aparte. Acá quedan los campos de
 * identificación y ubicación.
 */
export function VenueForm({ initialData, onSuccess, onCancel }: VenueFormProps) {
  const { form, submit, isPending, isEditing } = useVenueForm({ initialData, onSuccess });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-1">
        {/* Nombre de la Sede */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary-600" />
                Nombre de la Sede *
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej. Estadio Cincuentenario, Polideportivo La Paz" 
                  className="bg-white h-10" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dirección */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-600" />
                Dirección Física *
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej. Av. Néstor Kirchner y Av. Los Pinos" 
                  className="bg-white h-10" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Departamento y Localidad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Departamento *
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-56">
                    {FORMOSA_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
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
            name="locality"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Localidad / Ciudad *
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ej. Formosa, Clorinda, Pirané" 
                    className="bg-white h-10" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Capacidad */}
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary-600" />
                Capacidad Estimada (personas)
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ej. 1500"
                  className="bg-white h-10"
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === '' ? undefined : parseInt(val, 10));
                  }}
                />
              </FormControl>
              <FormDescription className="text-[11px] text-primary-500">
                Opcional. Aforo estimado de espectadores o participantes simultáneos.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <VenueCoordinateFields form={form} />

        {/* Estado Activo */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary-200/80 p-3 bg-white">
              <div className="space-y-0.5">
                <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5 cursor-pointer">
                  <CheckCircle2 className="w-4 h-4 text-primary-600" />
                  Sede Habilitada / Activa
                </FormLabel>
                <FormDescription className="text-[11px] text-primary-500">
                  Las sedes activas están disponibles para asignar partidos y eventos.
                </FormDescription>
              </div>
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-primary-100">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 cursor-pointer min-w-[140px]"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Registrar Sede'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

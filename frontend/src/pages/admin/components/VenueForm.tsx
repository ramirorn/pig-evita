// ===========================================
// Venue Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPin, Building2, Users, Navigation, CheckCircle2 } from 'lucide-react';
import { venueSchema, type VenueFormValues } from '@/schemas';
import { useCreateVenue, useUpdateVenue } from '@/hooks/useVenues';
import type { Venue } from '@/types';

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

export function VenueForm({ initialData, onSuccess, onCancel }: VenueFormProps) {
  const createMutation = useCreateVenue();
  const updateMutation = useUpdateVenue();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      address: initialData?.address || '',
      department: initialData?.department || 'Formosa',
      locality: initialData?.locality || '',
      capacity: initialData?.capacity ?? undefined,
      latitude: initialData?.latitude ?? undefined,
      longitude: initialData?.longitude ?? undefined,
      isActive: initialData?.isActive ?? true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        address: initialData.address,
        department: initialData.department,
        locality: initialData.locality,
        capacity: initialData.capacity ?? undefined,
        latitude: initialData.latitude ?? undefined,
        longitude: initialData.longitude ?? undefined,
        isActive: initialData.isActive ?? true,
      });
    }
  }, [initialData, form]);

  const onSubmit = async (values: VenueFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        address: values.address.trim(),
        department: values.department.trim(),
        locality: values.locality.trim(),
        capacity: values.capacity !== undefined && values.capacity !== null && !isNaN(values.capacity) ? Number(values.capacity) : undefined,
        latitude: values.latitude !== undefined && values.latitude !== null && !isNaN(values.latitude) ? Number(values.latitude) : undefined,
        longitude: values.longitude !== undefined && values.longitude !== null && !isNaN(values.longitude) ? Number(values.longitude) : undefined,
        isActive: values.isActive,
      };

      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 pt-1">
        {/* Nombre de la Sede */}
        <FormField
          control={form.control as any}
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
          control={form.control as any}
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
            control={form.control as any}
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
            control={form.control as any}
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
          control={form.control as any}
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

        {/* Coordenadas GPS (Latitud y Longitud) */}
        <div className="p-3 bg-primary-50/60 rounded-lg border border-primary-100 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-800">
            <Navigation className="w-3.5 h-3.5 text-primary-600" />
            <span>Coordenadas Geográficas (Opcional)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control as any}
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
              control={form.control as any}
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

        {/* Estado Activo */}
        <FormField
          control={form.control as any}
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
            {initialData ? 'Guardar Cambios' : 'Registrar Sede'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

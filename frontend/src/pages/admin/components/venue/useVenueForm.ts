// ===========================================
// useVenueForm — estado y envío del formulario de sedes
// ===========================================
import { useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { venueSchema, type VenueFormValues } from '@/schemas';
import type { Venue } from '@/types';
import { useCreateVenue, useUpdateVenue } from '@/hooks/useVenues';
import { logError } from '@/lib/logger';

/**
 * Tipo del objeto de RHF que se pasa a las secciones de campos como un único
 * prop `form`, igual que en el formulario de eventos: las secciones usan
 * `control` y podrían necesitar `watch`, y enumerar cada pedazo como prop
 * suelto haría crecer la lista con cada campo nuevo.
 */
export type VenueFormApi = UseFormReturn<VenueFormValues>;

/** Valores iniciales del form a partir de la sede que se está editando (o vacío). */
function buildDefaultValues(initialData?: Venue): VenueFormValues {
  return {
    name: initialData?.name || '',
    address: initialData?.address || '',
    // En alta se propone la capital; en edición se respeta el valor guardado tal cual.
    department: initialData ? initialData.department : 'Formosa',
    locality: initialData?.locality || '',
    capacity: initialData?.capacity ?? undefined,
    latitude: initialData?.latitude ?? undefined,
    longitude: initialData?.longitude ?? undefined,
    isActive: initialData?.isActive ?? true,
  };
}

/** Descarta el valor si el input numérico quedó vacío o con un `NaN`. */
function numeroOUndefined(valor: number | undefined | null): number | undefined {
  return valor !== undefined && valor !== null && !isNaN(valor) ? Number(valor) : undefined;
}

interface UseVenueFormOptions {
  initialData?: Venue;
  onSuccess?: () => void;
}

/**
 * Concentra lo que el formulario de sedes *hace*: valores por defecto,
 * resincronización al cambiar de sede y la limpieza de los campos numéricos
 * opcionales antes de mandarlos. Los componentes de campos quedan declarativos.
 */
export function useVenueForm({ initialData, onSuccess }: UseVenueFormOptions) {
  const createMutation = useCreateVenue();
  const updateMutation = useUpdateVenue();

  const form = useForm<VenueFormValues>({
    // El schema tiene `.default()`, así que los tipos de entrada y salida de Zod
    // difieren. El cast queda acotado acá en vez de repetirse en cada campo.
    resolver: zodResolver(venueSchema) as Resolver<VenueFormValues>,
    defaultValues: buildDefaultValues(initialData),
  });

  useEffect(() => {
    if (initialData) {
      form.reset(buildDefaultValues(initialData));
    }
  }, [initialData, form]);

  const submit: SubmitHandler<VenueFormValues> = async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        address: values.address.trim(),
        department: values.department.trim(),
        locality: values.locality.trim(),
        capacity: numeroOUndefined(values.capacity),
        latitude: numeroOUndefined(values.latitude),
        longitude: numeroOUndefined(values.longitude),
        isActive: values.isActive,
      };

      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      logError('VenueForm.onSubmit', error);
    }
  };

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing: Boolean(initialData),
  };
}

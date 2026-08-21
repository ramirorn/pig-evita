// ===========================================
// useParticipantForm — estado y envío del formulario de participantes
// ===========================================
import { useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type * as z from 'zod';
import { participantSchema } from '@/schemas';
import type { Participant } from '@/types';
import { Sex } from '@/types';
import { useCreateParticipant, useUpdateParticipant } from '@/hooks/useParticipants';
import { logError } from '@/lib/logger';

export type ParticipantFormValues = z.infer<typeof participantSchema>;

/** Tipo del objeto de RHF, por si alguna sección de campos necesita recibirlo. */
export type ParticipantFormApi = UseFormReturn<ParticipantFormValues>;

/** Form vacío para el alta. */
const EMPTY_VALUES: ParticipantFormValues = {
  dni: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  sex: Sex.MASCULINO,
  phone: '',
  email: '',
  locality: '',
  department: '',
  address: '',
};

/**
 * El participante que devuelve la API no es el valor del form: trae campos que
 * el form no maneja (`id`, timestamps, relaciones) y los opcionales pueden venir
 * en `null`. Zod descarta los primeros al validar y `nullishAVacio` normaliza
 * los segundos, así que se pasa el objeto entero en vez de mapear campo por
 * campo: mapear cambiaría qué se manda en el submit y esto es un refactor.
 */
function asFormValues(participant: Participant): ParticipantFormValues {
  return participant as unknown as ParticipantFormValues;
}

interface UseParticipantFormOptions {
  initialData?: Participant;
  onSuccess?: () => void;
}

/**
 * Concentra lo que el formulario de participantes *hace*: valores por defecto,
 * la resincronización al cambiar de participante (que además pasa la fecha de
 * nacimiento de ISO a `YYYY-MM-DD`, el único formato que entiende un
 * `<input type="date">`) y el envío al endpoint que corresponda.
 */
export function useParticipantForm({ initialData, onSuccess }: UseParticipantFormOptions) {
  const createMutation = useCreateParticipant();
  const updateMutation = useUpdateParticipant();

  const form = useForm<ParticipantFormValues>({
    // El schema transforma los opcionales (`'' -> undefined`), así que los tipos
    // de entrada y salida de Zod difieren. El cast queda acotado a esta línea en
    // vez de repetirse en el `control` de cada campo.
    resolver: zodResolver(participantSchema) as Resolver<ParticipantFormValues>,
    defaultValues: initialData ? asFormValues(initialData) : EMPTY_VALUES,
  });

  useEffect(() => {
    if (initialData) {
      // `toISOString()` siempre tiene la forma "YYYY-MM-DDTHH:mm:ss.sssZ", así que
      // los primeros 10 caracteres son la fecha: `slice` evita el acceso indexado
      // (y su `| undefined`) que traía el `split('T')[0]` original.
      const formattedDate = initialData.birthDate
        ? new Date(initialData.birthDate).toISOString().slice(0, 10)
        : '';

      form.reset({
        ...asFormValues(initialData),
        birthDate: formattedDate,
      });
    }
  }, [initialData, form]);

  const submit: SubmitHandler<ParticipantFormValues> = async (values) => {
    try {
      if (initialData?.id) {
        await updateMutation.mutateAsync({ id: initialData.id, payload: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onSuccess?.();
    } catch (error) {
      logError('ParticipantForm.onSubmit', error);
    }
  };

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing: Boolean(initialData),
  };
}

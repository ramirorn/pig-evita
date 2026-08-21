// ===========================================
// useUserForm — estado y envío del formulario de usuarios
// ===========================================
import { useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createUserSchema, updateUserSchema } from '@/schemas';
import { UserRole, type User } from '@/types';
import { useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import { logError } from '@/lib/logger';

/**
 * El form usa siempre la forma del schema de edición porque es el más ancho:
 * agrega `isActive` y afloja `password` (vacío = "no cambiar"). En alta se
 * valida con `createUserSchema`, que exige la contraseña.
 */
export type UserFormValues = z.infer<typeof updateUserSchema>;

/** Tipo del objeto de RHF, por si alguna sección de campos necesita recibirlo. */
export type UserFormApi = UseFormReturn<UserFormValues>;

/** Payload de actualización: la contraseña sólo viaja si el usuario escribió una nueva. */
interface UpdateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  zone?: string;
  isActive?: boolean;
  password?: string;
}

/** Valores iniciales del form a partir del usuario que se está editando (o vacío). */
function buildDefaultValues(initialData?: User): UserFormValues {
  return {
    email: initialData?.email || '',
    // Nunca se precarga la contraseña actual: el backend no la devuelve.
    password: '',
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    role: initialData?.role || UserRole.COORDINADOR,
    department: initialData?.department || '',
    zone: initialData?.zone || '',
    isActive: initialData ? initialData.isActive : true,
  };
}

interface UseUserFormOptions {
  initialData?: User;
  onSuccess?: () => void;
}

/**
 * Concentra lo que el formulario de usuarios *hace*: elegir el schema según
 * sea alta o edición, los valores por defecto, la resincronización al cambiar
 * de usuario y el armado de los dos payloads distintos que espera la API.
 */
export function useUserForm({ initialData, onSuccess }: UseUserFormOptions) {
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const isEditing = Boolean(initialData);
  const currentSchema = isEditing ? updateUserSchema : createUserSchema;

  const form = useForm<UserFormValues>({
    // `updateUserSchema` tiene `.default()` en `isActive`, así que los tipos de
    // entrada y salida de Zod difieren; además acá el schema se elige en runtime.
    // El cast queda acotado a esta línea en vez de repetirse en cada campo.
    resolver: zodResolver(currentSchema) as Resolver<UserFormValues>,
    defaultValues: buildDefaultValues(initialData),
  });

  useEffect(() => {
    if (initialData) {
      form.reset(buildDefaultValues(initialData));
    }
  }, [initialData, form]);

  const submit: SubmitHandler<UserFormValues> = async (values) => {
    try {
      if (isEditing && initialData) {
        const payload: UpdateUserPayload = {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          department: values.department || undefined,
          zone: values.zone || undefined,
          isActive: values.isActive,
        };

        if (values.password && values.password.trim().length >= 8) {
          payload.password = values.password;
        }

        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync({
          email: values.email,
          password: values.password || '',
          firstName: values.firstName,
          lastName: values.lastName,
          role: values.role,
          department: values.department || undefined,
          zone: values.zone || undefined,
        });
      }
      onSuccess?.();
    } catch (error) {
      logError('UserForm.onSubmit', error);
    }
  };

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing,
  };
}

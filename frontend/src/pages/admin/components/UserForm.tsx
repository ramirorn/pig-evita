// ===========================================
// User Form Component
// ===========================================
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { createUserSchema, updateUserSchema } from '@/schemas';
import { useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import { UserRole, type User } from '@/types';
import { ROLE_LABELS } from '@/lib/constants';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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

const FORMOSA_DEPARTMENTS = [
  'Formosa',
  'Bermejo',
  'Laishí',
  'Matacos',
  'Patiño',
  'Pilagás',
  'Pilcomayo',
  'Pirané',
  'Ramón Lista',
];

interface UserFormProps {
  initialData?: User;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function UserForm({ initialData, onSuccess, onCancel }: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isEditing = !!initialData;

  const currentSchema = isEditing ? updateUserSchema : createUserSchema;
  type FormValues = z.infer<typeof updateUserSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(currentSchema) as any,
    defaultValues: {
      email: initialData?.email || '',
      password: '',
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      role: initialData?.role || UserRole.COORDINADOR,
      department: initialData?.department || '',
      zone: initialData?.zone || '',
      isActive: initialData ? initialData.isActive : true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        email: initialData.email,
        password: '',
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        role: initialData.role,
        department: initialData.department || '',
        zone: initialData.zone || '',
        isActive: initialData.isActive,
      });
    }
  }, [initialData, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && initialData) {
        const payload: {
          email: string;
          firstName: string;
          lastName: string;
          role: string;
          department?: string;
          zone?: string;
          isActive?: boolean;
          password?: string;
        } = {
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
      console.error('Error submitting user form:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Juan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Pérez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control as any}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input type="email" placeholder="usuario@juegosevita.gob.ar" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control as any}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isEditing ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
              </FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={
                      isEditing
                        ? 'Dejar en blanco para mantener la actual'
                        : 'Mínimo 8 caracteres'
                    }
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600 focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rol en el Sistema</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(UserRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role] || role}
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
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departamento (Opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                  value={field.value || 'none'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin departamento / Provincial</SelectItem>
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
        </div>

        <FormField
          control={form.control as any}
          name="zone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zona (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Zona 1 - Centro" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEditing && (
          <FormField
            control={form.control as any}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary-100 p-3 shadow-xs">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium text-primary-900">
                    Usuario Activo
                  </FormLabel>
                  <p className="text-xs text-primary-500">
                    Permite al usuario iniciar sesión y operar en el panel.
                  </p>
                </div>
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-primary-100">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Actualizar Usuario' : 'Crear Usuario'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

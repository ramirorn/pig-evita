// ===========================================
// Team Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { teamSchema } from '@/schemas';
import { useCreateTeam, useUpdateTeam } from '@/hooks/useTeams';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { type Team } from '@/types';

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
import { logError } from '@/lib/logger';

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamFormProps {
  initialData?: Team;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TeamForm({ initialData, onSuccess, onCancel }: TeamFormProps) {
  const createMutation = useCreateTeam();
  const updateMutation = useUpdateTeam();
  
  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplinesData } = useAllDisciplines({ isActive: true });
  
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema) as any,
    defaultValues: {
      name: '',
      disciplineId: '',
      categoryId: '',
      locality: '',
      department: '',
    },
  });

  const selectedDiscipline = form.watch('disciplineId');
  const { data: categoriesData } = useAllCategories(
    { disciplineId: selectedDiscipline || undefined, isActive: true },
    // Sin disciplina elegida el select está deshabilitado: no hay nada que pedir.
    { enabled: Boolean(selectedDiscipline) },
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        disciplineId: initialData.disciplineId,
        categoryId: initialData.categoryId,
        locality: initialData.locality,
        department: initialData.department,
      });
    }
  }, [initialData, form]);

  // Reset category if discipline changes
  useEffect(() => {
    if (selectedDiscipline && !initialData) {
      form.setValue('categoryId', '');
    }
  }, [selectedDiscipline, form, initialData]);

  const onSubmit = async (values: TeamFormValues) => {
    try {
      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onSuccess?.();
    } catch (error) {
      logError('TeamForm.onSubmit', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        <FormField
          control={form.control as any}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Equipo</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Club San Martín" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="disciplineId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Disciplina</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar disciplina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(disciplinesData ?? []).map((discipline) => (
                      <SelectItem key={discipline.id} value={discipline.id}>
                        {discipline.name}
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
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!selectedDiscipline}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(categoriesData ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departamento</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Formosa" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="locality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localidad</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Herradura" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Actualizar' : 'Crear'} Equipo
          </Button>
        </div>
      </form>
    </Form>
  );
}

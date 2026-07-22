// ===========================================
// Competition Form Component
// ===========================================
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { competitionSchema } from '@/schemas';
import type { Competition } from '@/types';
import { CompetitionStage, CompetitionFormat } from '@/types';
import { useCreateCompetition, useUpdateCompetition } from '@/hooks/useCompetitions';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';

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
import { Loader2 } from 'lucide-react';

type CompetitionFormValues = z.infer<typeof competitionSchema>;

interface CompetitionFormProps {
  initialData?: Competition;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CompetitionForm({ initialData, onSuccess, onCancel }: CompetitionFormProps) {
  const createMutation = useCreateCompetition();
  const updateMutation = useUpdateCompetition();
  
  const { data: disciplinesData } = useDisciplines({ isActive: true });
  
  const isPending = createMutation.isPending || updateMutation.isPending;
  
  const form = useForm<CompetitionFormValues>({
    resolver: zodResolver(competitionSchema) as any,
    defaultValues: (initialData as any) || {
      name: '',
      disciplineId: '',
      categoryId: '',
      stage: CompetitionStage.ZONAL,
      format: CompetitionFormat.ELIMINACION_DIRECTA,
      startDate: '',
      endDate: '',
    },
  });

  const selectedDiscipline = form.watch('disciplineId');
  const { data: categoriesData } = useCategories({ 
    disciplineId: selectedDiscipline,
    isActive: true 
  });

  const onSubmit = async (values: CompetitionFormValues) => {
    try {
      if (initialData?.id) {
        await updateMutation.mutateAsync({ id: initialData.id, payload: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      onSuccess?.();
    } catch (error) {
      console.error(error);
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
              <FormLabel>Nombre de la Competencia (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Fase Zonal Voley Sub 15" {...field} value={field.value || ''} />
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
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!!initialData}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {disciplinesData?.data.map((discipline) => (
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
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value} 
                  defaultValue={field.value} 
                  disabled={!selectedDiscipline || !!initialData}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedDiscipline ? 'Seleccione disciplina primero' : 'Seleccionar'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoriesData?.data.map((category) => (
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
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Etapa</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!!initialData}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={CompetitionStage.ZONAL}>Zonal</SelectItem>
                    <SelectItem value={CompetitionStage.DEPARTAMENTAL}>Departamental</SelectItem>
                    <SelectItem value={CompetitionStage.PROVINCIAL}>Provincial</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="format"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Formato</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={!!initialData}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={CompetitionFormat.ROUND_ROBIN}>Liga (Todos contra todos)</SelectItem>
                    <SelectItem value={CompetitionFormat.ELIMINACION_DIRECTA}>Eliminatoria Directa</SelectItem>
                    <SelectItem value={CompetitionFormat.FASE_GRUPOS}>Fase de Grupos</SelectItem>
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
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Inicio (Opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Fin (Opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData ? 'Guardar Cambios' : 'Crear Competencia'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

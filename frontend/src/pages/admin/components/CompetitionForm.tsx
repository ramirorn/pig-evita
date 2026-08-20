// ===========================================
// Competition Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { competitionSchema } from '@/schemas';
import type { Competition } from '@/types';
import { CompetitionStage, CompetitionFormat } from '@/types';
import { useCreateCompetition, useUpdateCompetition } from '@/hooks/useCompetitions';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import type { CreateCompetitionPayload, UpdateCompetitionPayload } from '@/api/competitions.api';

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
import { Loader2 } from 'lucide-react';
import { logError } from '@/lib/logger';

type CompetitionFormValues = z.infer<typeof competitionSchema>;

interface CompetitionFormProps {
  initialData?: Competition;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function formatDateForInput(dateValue?: string | Date | null): string {
  if (!dateValue) return '';
  const dateStr = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();
  return dateStr.slice(0, 10);
}

export function CompetitionForm({ initialData, onSuccess, onCancel }: CompetitionFormProps) {
  const createMutation = useCreateCompetition();
  const updateMutation = useUpdateCompetition();
  
  const { data: disciplinesData } = useDisciplines({ isActive: true });
  
  const isPending = createMutation.isPending || updateMutation.isPending;
  
  const form = useForm<CompetitionFormValues>({
    resolver: zodResolver(competitionSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      disciplineId: initialData?.disciplineId || '',
      categoryId: initialData?.categoryId || '',
      stage: initialData?.stage || CompetitionStage.ZONAL,
      format: initialData?.format || CompetitionFormat.ELIMINACION_DIRECTA,
      startDate: formatDateForInput(initialData?.startDate),
      endDate: formatDateForInput(initialData?.endDate),
    },
  });

  const selectedDiscipline = form.watch('disciplineId');
  const { data: categoriesData } = useCategories({ 
    disciplineId: selectedDiscipline || undefined,
    isActive: true 
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || '',
        disciplineId: initialData.disciplineId,
        categoryId: initialData.categoryId,
        stage: initialData.stage,
        format: initialData.format,
        startDate: formatDateForInput(initialData.startDate),
        endDate: formatDateForInput(initialData.endDate),
      });
    }
  }, [initialData, form]);

  const onSubmit = async (values: CompetitionFormValues) => {
    try {
      const trimmedName = values.name?.trim();
      const sanitizedStartDate = values.startDate && values.startDate.trim() !== ''
        ? new Date(values.startDate).toISOString()
        : undefined;
      const sanitizedEndDate = values.endDate && values.endDate.trim() !== ''
        ? new Date(values.endDate).toISOString()
        : undefined;

      if (initialData?.id) {
        const payload: UpdateCompetitionPayload = {
          name: trimmedName || undefined,
          stage: values.stage,
          format: values.format,
          startDate: sanitizedStartDate,
          endDate: sanitizedEndDate,
        };
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        const payload: CreateCompetitionPayload = {
          disciplineId: values.disciplineId,
          categoryId: values.categoryId,
          stage: values.stage,
          format: values.format,
          name: trimmedName || undefined,
          startDate: sanitizedStartDate,
          endDate: sanitizedEndDate,
        };
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      logError('CompetitionForm.onSubmit', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Nombre opcional */}
        <FormField
          control={form.control as any}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900">
                Nombre de la Competencia (Opcional)
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej. Fase Zonal Vóley Sub 15 - Región Centro" 
                  className="bg-white h-10"
                  {...field} 
                  value={field.value || ''} 
                />
              </FormControl>
              <FormDescription className="text-[11px] text-primary-500">
                Si se omite, se generará automáticamente con el nombre de la disciplina y categoría.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Disciplina y Categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="disciplineId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Disciplina *
                </FormLabel>
                <Select 
                  onValueChange={(val) => {
                    field.onChange(val);
                    form.setValue('categoryId', '');
                  }} 
                  value={field.value} 
                  disabled={!!initialData}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder="Seleccionar disciplina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-56">
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
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Categoría *
                </FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value} 
                  disabled={!selectedDiscipline || !!initialData}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder={!selectedDiscipline ? 'Seleccione disciplina primero' : 'Seleccionar categoría'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-56">
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

        {/* Etapa y Formato */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Etapa *
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData}>
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder="Seleccionar etapa" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={CompetitionStage.DEPARTAMENTAL}>Departamental</SelectItem>
                    <SelectItem value={CompetitionStage.ZONAL}>Zonal</SelectItem>
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
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Formato de Competencia *
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!initialData}>
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder="Seleccionar formato" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={CompetitionFormat.ROUND_ROBIN}>Liga (Todos contra todos)</SelectItem>
                    <SelectItem value={CompetitionFormat.ELIMINACION_DIRECTA}>Eliminatoria Directa</SelectItem>
                    <SelectItem value={CompetitionFormat.FASE_GRUPOS}>Fase de Grupos + Playoffs</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Fechas de inicio y fin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Fecha de Inicio (Opcional)
                </FormLabel>
                <FormControl>
                  <Input type="date" className="bg-white h-10" {...field} value={field.value || ''} />
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
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Fecha de Fin (Opcional)
                </FormLabel>
                <FormControl>
                  <Input type="date" className="bg-white h-10" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-primary-100">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending} className="cursor-pointer">
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="gap-2 cursor-pointer min-w-[140px]">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {initialData ? 'Guardar Cambios' : 'Crear Competencia'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

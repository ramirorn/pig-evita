// ===========================================
// useCompetitionForm — estado, catálogos y envío del formulario de competencias
// ===========================================
import { useEffect } from 'react';
import { useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type * as z from 'zod';
import { competitionSchema } from '@/schemas';
import type { Competition } from '@/types';
import { CompetitionStage, CompetitionFormat } from '@/types';
import { useCreateCompetition, useUpdateCompetition } from '@/hooks/useCompetitions';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import type { CreateCompetitionPayload, UpdateCompetitionPayload } from '@/api/competitions.api';
import { logError } from '@/lib/logger';

export type CompetitionFormValues = z.infer<typeof competitionSchema>;

/** Tipo del objeto de RHF, por si alguna sección de campos necesita recibirlo. */
export type CompetitionFormApi = UseFormReturn<CompetitionFormValues>;

/** Recorta un ISO del backend al `YYYY-MM-DD` que espera un `<input type="date">`. */
function formatDateForInput(dateValue?: string | Date | null): string {
  if (!dateValue) return '';
  const dateStr = typeof dateValue === 'string' ? dateValue : dateValue.toISOString();
  return dateStr.slice(0, 10);
}

/** Convierte una fecha del form al ISO que espera la API, o la descarta si está vacía. */
function toIsoOrUndefined(value?: string | null): string | undefined {
  return value && value.trim() !== '' ? new Date(value).toISOString() : undefined;
}

/** Valores iniciales del form a partir de la competencia que se edita (o vacío). */
function buildDefaultValues(initialData?: Competition): CompetitionFormValues {
  return {
    name: initialData?.name || '',
    disciplineId: initialData?.disciplineId || '',
    categoryId: initialData?.categoryId || '',
    stage: initialData?.stage || CompetitionStage.ZONAL,
    format: initialData?.format || CompetitionFormat.ELIMINACION_DIRECTA,
    startDate: formatDateForInput(initialData?.startDate),
    endDate: formatDateForInput(initialData?.endDate),
  };
}

interface UseCompetitionFormOptions {
  initialData?: Competition;
  onSuccess?: () => void;
}

/**
 * Concentra lo que el formulario de competencias *hace*: valores por defecto,
 * resincronización, los dos catálogos que llenan los selects (las categorías
 * dependen de la disciplina elegida, por eso la query vive acá y no en la
 * página) y la traducción de fechas al ISO que espera la API.
 *
 * En edición la API sólo acepta un subconjunto de campos: disciplina, categoría
 * y etapa quedan congeladas, así que el payload de update es más chico.
 */
export function useCompetitionForm({ initialData, onSuccess }: UseCompetitionFormOptions) {
  const createMutation = useCreateCompetition();
  const updateMutation = useUpdateCompetition();

  const { data: disciplinesData } = useDisciplines({ isActive: true });

  const form = useForm<CompetitionFormValues>({
    // El schema cierra con `.refine()`, así que los tipos de entrada y salida de
    // Zod difieren. El cast queda acotado acá en vez de repetirse en cada campo.
    resolver: zodResolver(competitionSchema) as Resolver<CompetitionFormValues>,
    defaultValues: buildDefaultValues(initialData),
  });

  const selectedDiscipline = form.watch('disciplineId');
  const { data: categoriesData } = useCategories({
    disciplineId: selectedDiscipline || undefined,
    isActive: true,
  });

  useEffect(() => {
    if (initialData) {
      form.reset(buildDefaultValues(initialData));
    }
  }, [initialData, form]);

  const submit: SubmitHandler<CompetitionFormValues> = async (values) => {
    try {
      const trimmedName = values.name?.trim();
      const sanitizedStartDate = toIsoOrUndefined(values.startDate);
      const sanitizedEndDate = toIsoOrUndefined(values.endDate);

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

  return {
    form,
    submit,
    isPending: createMutation.isPending || updateMutation.isPending,
    isEditing: Boolean(initialData),
    selectedDiscipline,
    disciplines: disciplinesData?.data,
    categories: categoriesData?.data,
  };
}

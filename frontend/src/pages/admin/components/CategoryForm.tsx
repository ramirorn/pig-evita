// ===========================================
// Category Form Component
// ===========================================
import { NumberField } from '@/components/ui/number-field';
import { Switch } from '@/components/ui/switch';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { categorySchema } from '@/schemas';
import { useCreateCategory, useUpdateCategory } from '@/hooks/useCategories';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { AgeCriterion, Sex, type Category } from '@/types';
import { AGE_CRITERION_LABELS, SEX_LABELS } from '@/lib/constants';

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

type CategoryFormValues = z.infer<typeof categorySchema>;

/** Input numérico vacío → `null`, que es lo que el schema y la API esperan. */
// El campo numérico entrega `undefined` cuando queda vacío; acá un vacío viaja como `null`.
const aEntero = (valor: number | undefined) => valor ?? null;

/**
 * El par del criterio que no se eligió viaja en `null`. En el formulario se
 * conserva mientras se edita (ir y volver de criterio no borra lo tipeado),
 * pero no se guarda: una categoría por año no tiene rango de edad.
 */
function aPayload(values: CategoryFormValues): CategoryFormValues {
  return values.ageCriterion === AgeCriterion.BIRTH_YEAR
    ? { ...values, minAge: null, maxAge: null }
    : { ...values, minBirthYear: null, maxBirthYear: null };
}

interface CategoryFormProps {
  initialData?: Category;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CategoryForm({ initialData, onSuccess, onCancel }: CategoryFormProps) {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplinesData } = useAllDisciplines({ isActive: true });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues: (initialData as any) || {
      disciplineId: '',
      name: '',
      ageCriterion: AgeCriterion.AGE,
      minAge: 5,
      maxAge: 99,
      minBirthYear: null,
      maxBirthYear: null,
      sex: Sex.MIXTO,
      isActive: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        disciplineId: initialData.disciplineId,
        name: initialData.name,
        // Las categorías creadas antes del criterio no lo traen: eran por edad.
        ageCriterion: initialData.ageCriterion ?? AgeCriterion.AGE,
        minAge: initialData.minAge ?? null,
        maxAge: initialData.maxAge ?? null,
        minBirthYear: initialData.minBirthYear ?? null,
        maxBirthYear: initialData.maxBirthYear ?? null,
        sex: initialData.sex,
        isActive: initialData.isActive,
      });
    }
  }, [initialData, form]);

  const ageCriterion = form.watch('ageCriterion');

  /**
   * Al pasar de edad a año de nacimiento, propone los años equivalentes en el
   * año en curso (12 a 14 años hoy → nacidos de 2012 a 2014) si todavía no hay
   * años cargados. Es un punto de partida editable, no una conversión exacta.
   */
  const cambiarCriterio = (siguiente: AgeCriterion) => {
    form.setValue('ageCriterion', siguiente, { shouldDirty: true });
    if (siguiente !== AgeCriterion.BIRTH_YEAR) return;
    const { minAge, maxAge, minBirthYear, maxBirthYear } = form.getValues();
    if (minBirthYear === null && maxBirthYear === null && minAge !== null && maxAge !== null) {
      const anio = new Date().getFullYear();
      form.setValue('minBirthYear', anio - maxAge, { shouldDirty: true });
      form.setValue('maxBirthYear', anio - minAge, { shouldDirty: true });
    }
  };

  const onSubmit = async (values: CategoryFormValues) => {
    const payload = aPayload(values);
    try {
      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      logError('CategoryForm.onSubmit', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
        <FormField
          control={form.control}
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
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Categoría</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Sub 14, Libre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ageCriterion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Criterio de edad</FormLabel>
              <Select
                onValueChange={(valor) => cambiarCriterio(valor as AgeCriterion)}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar criterio" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(AgeCriterion).map((criterio) => (
                    <SelectItem key={criterio} value={criterio}>
                      {AGE_CRITERION_LABELS[criterio]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {field.value === AgeCriterion.BIRTH_YEAR
                  ? 'Entran los nacidos entre los años indicados, sin importar si ya cumplieron años.'
                  : 'Entran quienes tengan la edad indicada al momento de inscribirse.'}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {ageCriterion === AgeCriterion.BIRTH_YEAR ? (
          <div className="grid grid-cols-2 items-start gap-4">
            <FormField
              key="minBirthYear"
              control={form.control}
              name="minBirthYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año de nacimiento desde</FormLabel>
                  <FormControl>
                    <NumberField
                      min={0}
                      placeholder="Ej. 2012"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onValueChange={(valor) => field.onChange(aEntero(valor))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              key="maxBirthYear"
              control={form.control}
              name="maxBirthYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año de nacimiento hasta</FormLabel>
                  <FormControl>
                    <NumberField
                      min={0}
                      placeholder="Ej. 2014"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onValueChange={(valor) => field.onChange(aEntero(valor))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 items-start gap-4">
            <FormField
              key="minAge"
              control={form.control}
              name="minAge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edad Mínima</FormLabel>
                  <FormControl>
                    <NumberField
                      min={0}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onValueChange={(valor) => field.onChange(aEntero(valor))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              key="maxAge"
              control={form.control}
              name="maxAge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edad Máxima</FormLabel>
                  <FormControl>
                    <NumberField
                      min={0}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value}
                      onValueChange={(valor) => field.onChange(aEntero(valor))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sexo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sexo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(Sex).map((sex) => (
                    <SelectItem key={sex} value={sex}>
                      {SEX_LABELS[sex]}
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
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Estado Activo</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Habilita o deshabilita la categoría para inscripciones.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Actualizar' : 'Crear'} Categoría
          </Button>
        </div>
      </form>
    </Form>
  );
}

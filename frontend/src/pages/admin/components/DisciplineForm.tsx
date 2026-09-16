// ===========================================
// Discipline Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { disciplineSchema } from '@/schemas';
import { useCreateDiscipline, useUpdateDiscipline } from '@/hooks/useDisciplines';
import { DisciplineType, ResultType, type Discipline } from '@/types';
import { DISCIPLINE_TYPE_LABELS, RESULT_TYPE_LABELS } from '@/lib/constants';

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

type DisciplineFormValues = z.infer<typeof disciplineSchema>;

interface DisciplineFormProps {
  initialData?: Discipline;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DisciplineForm({ initialData, onSuccess, onCancel }: DisciplineFormProps) {
  const createMutation = useCreateDiscipline();
  const updateMutation = useUpdateDiscipline();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<DisciplineFormValues>({
    resolver: zodResolver(disciplineSchema) as any,
    defaultValues: (initialData as any) || {
      name: '',
      type: DisciplineType.INDIVIDUAL,
      resultType: ResultType.TIEMPO,
      minPlayers: 1,
      maxPlayers: 1,
      sortOrder: 0,
      isActive: true,
    },
  });

  // Populate form if editing
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        type: initialData.type,
        resultType: initialData.resultType,
        rules: initialData.rules || '',
        minPlayers: initialData.minPlayers || undefined,
        maxPlayers: initialData.maxPlayers || undefined,
        // `?? undefined` y no `|| undefined`: `maxSuplentes: 0` es un valor
        // legítimo ("no admite suplentes") y con `||` se perdería en cada
        // edición, obligando a volver a cargarlo.
        titulares: initialData.titulares ?? undefined,
        maxSuplentes: initialData.maxSuplentes ?? undefined,
        sortOrder: initialData.sortOrder,
        isActive: initialData.isActive,
      });
    }
  }, [initialData, form]);

  // Los campos de plantel sólo existen para las disciplinas de equipo; el
  // formulario los muestra u oculta según el tipo elegido en vivo.
  const tipoElegido = form.watch('type');
  const esEquipo = tipoElegido === DisciplineType.EQUIPO;

  const onSubmit = async (values: DisciplineFormValues) => {
    // Una disciplina que dejó de ser de equipo no puede seguir arrastrando un
    // plantel: se manda `null` para que el backend lo limpie, no `undefined`,
    // que con un PATCH significa "no toques este campo".
    const payload = esEquipo ? values : { ...values, titulares: null, maxSuplentes: null };

    try {
      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      logError('DisciplineForm.onSubmit', error);
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
              <FormLabel>Nombre de la Disciplina</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Atletismo, Fútbol 11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(DisciplineType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {DISCIPLINE_TYPE_LABELS[type]}
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
            name="resultType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Resultado</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar resultado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(ResultType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {RESULT_TYPE_LABELS[type]}
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
            name="minPlayers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jugadores Mínimos</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control as any}
            name="maxPlayers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jugadores Máximos</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/*
          Sin estos dos datos, el alta de plantel completo no se puede usar con
          la disciplina: la pantalla de inscripción no tiene contra qué contar
          los titulares y corta el flujo en el primer paso. Por eso el schema
          los exige cuando el tipo es EQUIPO, en vez de dejarlos opcionales.
        */}
        {esEquipo && (
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-primary-900">Plantel reglamentario</p>
              <p className="text-xs text-muted-foreground">
                Cuántos jugadores entran a la cancha y cuántos suplentes se pueden inscribir.
                Es lo que la inscripción por plantel usa para ir contando.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="titulares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titulares</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Ej. 11"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="maxSuplentes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suplentes máximos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ej. 5"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        <FormField
          control={form.control as any}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Estado Activo</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Habilita o deshabilita la disciplina en el sistema.
                </p>
              </div>
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
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
            {initialData ? 'Actualizar' : 'Crear'} Disciplina
          </Button>
        </div>
      </form>
    </Form>
  );
}

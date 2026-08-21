// ===========================================
// Competition Form Component
// ===========================================
import type { Competition } from '@/types';
import { CompetitionStage, CompetitionFormat } from '@/types';
import { useCompetitionForm } from './competition/useCompetitionForm';

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

interface CompetitionFormProps {
  initialData?: Competition;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Formulario de alta/edición de competencias.
 *
 * Sólo arma el layout: los valores por defecto, los catálogos que llenan los
 * selects y los dos payloads distintos (alta vs edición) viven en
 * `useCompetitionForm`.
 */
export function CompetitionForm({ initialData, onSuccess, onCancel }: CompetitionFormProps) {
  const { form, submit, isPending, isEditing, selectedDiscipline, disciplines, categories } =
    useCompetitionForm({ initialData, onSuccess });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {/* Nombre opcional */}
        <FormField
          control={form.control}
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
            control={form.control}
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
                  disabled={isEditing}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder="Seleccionar disciplina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-56">
                    {disciplines?.map((discipline) => (
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
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Categoría *
                </FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value} 
                  disabled={!selectedDiscipline || isEditing}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white h-10">
                      <SelectValue placeholder={!selectedDiscipline ? 'Seleccione disciplina primero' : 'Seleccionar categoría'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-56">
                    {categories?.map((category) => (
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
            control={form.control}
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Etapa *
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
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
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-primary-900">
                  Formato de Competencia *
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
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
            control={form.control}
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
            control={form.control}
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
            {isEditing ? 'Guardar Cambios' : 'Crear Competencia'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

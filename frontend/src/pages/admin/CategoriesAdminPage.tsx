// ===========================================
// Categories Admin Page
// ===========================================
import { useMemo } from 'react';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import { createCategoryColumns } from './categories/categoryColumns';
import { Tag, Plus } from 'lucide-react';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import type { Category } from '@/types';
import { CategoryForm } from './components/CategoryForm';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logError } from '@/lib/logger';
import { FilterPanel } from '@/components/shared/FilterPanel';

interface CategoryFilters {
  disciplineId: string;
}

const EMPTY_FILTERS: CategoryFilters = { disciplineId: 'all' };

export function CategoriesAdminPage() {
  const crud = useCrudPageState<Category, CategoryFilters>(EMPTY_FILTERS);
  const { filters, page, limit, editing: editingCategory, deleting: deletingCategory } = crud;
  const { disciplineId } = filters;
  const { openEdit, askDelete } = crud;

  // El selector de disciplinas recorre la paginación hasta el final (S06): con
  // el hook paginado ofrecía como mucho 20 opciones y la 21 era infiltrable.
  const { data: disciplines } = useAllDisciplines();
  const { data: categoriesData, isLoading, isFetching, isError, refetch } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteCategory();

  // Tocar el filtro vuelve a la primera página: el resultado es otro y la
  // página en la que estabas puede ya no existir.
  const patchDiscipline = (value: string) => crud.patchFilters({ disciplineId: value });

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      await deleteMutation.mutateAsync(deletingCategory.id);
      crud.cancelDelete();
    } catch (error) {
      logError('CategoriesAdminPage.handleDeleteConfirm', error);
    }
  };

  // Memoizadas: sin esto el DataTable recibía columnas nuevas en cada render
  // (cada tecla en el buscador) y re-renderizaba todas las celdas.
  const columns = useMemo(() => createCategoryColumns({ onEdit: openEdit, onDelete: askDelete }), [openEdit, askDelete]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        description="Gestión de rangos de edad y sexo por disciplina"
        icon={<Tag className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={crud.openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </Button>
        }
      />

      <DataTable
        entityName="categorías"
        columns={columns}
        rows={categoriesData?.data ?? []}
        getRowId={(category) => category.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRowInactive={(category) => !category.isActive}
        meta={categoriesData?.meta}
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={disciplineId !== 'all'}
        onClearFilters={crud.clearFilters}
        emptyIcon={<Tag className="w-10 h-10" />}
        emptyTitle="Todavía no hay categorías"
        emptyDescription="Registrá la primera categoría para empezar a clasificar a los participantes por edad y sexo."
        emptyAction={
          <Button onClick={crud.openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Categoría
          </Button>
        }
        toolbar={
          <FilterPanel activeCount={disciplineId !== 'all' ? 1 : 0}>
          <div className="w-full md:w-80">
            <Select value={disciplineId} onValueChange={patchDiscipline}>
              <SelectTrigger aria-label="Filtrar por disciplina">
                <SelectValue placeholder="Filtrar por disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {(disciplines ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </FilterPanel>
        }
      />

      <Dialog open={crud.isFormOpen} onOpenChange={crud.onFormOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            initialData={editingCategory}
            onSuccess={crud.closeForm}
            onCancel={crud.closeForm}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingCategory}
        title="¿Eliminar categoría?"
        description={`¿Estás seguro de que deseas eliminar la categoría "${deletingCategory?.name}"? Si contiene inscripciones o equipos asociados, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => crud.cancelDelete()}
      />
    </div>
  );
}

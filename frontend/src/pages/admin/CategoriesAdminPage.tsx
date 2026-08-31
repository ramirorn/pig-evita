// ===========================================
// Categories Admin Page
// ===========================================
import { useState } from 'react';
import { Tag, Plus, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import type { Category } from '@/types';
import { SEX_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { CategoryForm } from './components/CategoryForm';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logError } from '@/lib/logger';

export function CategoriesAdminPage() {
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

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
  const patchDiscipline = (value: string) => {
    setDisciplineId(value);
    setPage(1);
  };

  const clearFilters = () => {
    setDisciplineId('all');
    setPage(1);
  };

  const handleCreate = () => {
    setEditingCategory(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(undefined);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      await deleteMutation.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
    } catch (error) {
      logError('CategoriesAdminPage.handleDeleteConfirm', error);
    }
  };

  const columns: DataTableColumn<Category>[] = [
    {
      id: 'discipline',
      header: 'Disciplina',
      className: 'text-primary-600 font-medium',
      cell: (category) => category.discipline?.name || '—',
    },
    {
      id: 'name',
      header: 'Nombre / Categoría',
      // Es el identificador de la fila, aunque no haya detalle al que navegar:
      // `<th scope="row">` hace que el lector lo repita como contexto de cada celda.
      rowHeader: true,
      className: 'font-bold text-primary-900',
      headClassName: 'min-w-[180px]',
      cell: (category) => category.name,
    },
    {
      id: 'ages',
      header: 'Edades',
      cell: (category) => `${category.minAge} a ${category.maxAge} años`,
    },
    {
      id: 'sex',
      header: 'Sexo',
      cell: (category) => (
        // `variant="secondary"` no renderiza color: `bg-secondary` no existe en
        // el `@theme`. Se usan tokens explícitos que sí resuelven.
        <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
          {SEX_LABELS[category.sex]}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (category) =>
        category.isActive ? (
          // `green-*` y `red-*` están fuera de la paleta institucional.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activo
          </Badge>
        ) : (
          // Inactivo no es un error: el estado neutro lo comunica mejor que el rojo.
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Inactivo
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (category) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${category.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(category)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeletingCategory(category)}
              className="text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Categorías"
        description="Gestión de rangos de edad y sexo por disciplina"
        icon={<Tag className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
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
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={disciplineId !== 'all'}
        onClearFilters={clearFilters}
        emptyIcon={<Tag className="w-10 h-10" />}
        emptyTitle="Todavía no hay categorías"
        emptyDescription="Registrá la primera categoría para empezar a clasificar a los participantes por edad y sexo."
        emptyAction={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Categoría
          </Button>
        }
        toolbar={
          <div className="w-full md:max-w-sm">
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
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            initialData={editingCategory}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingCategory}
        title="¿Eliminar categoría?"
        description={`¿Estás seguro de que deseas eliminar la categoría "${deletingCategory?.name}"? Si contiene inscripciones o equipos asociados, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCategory(null)}
      />
    </div>
  );
}

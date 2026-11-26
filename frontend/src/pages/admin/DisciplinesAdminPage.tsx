// ===========================================
// Disciplines Admin Page
// ===========================================
import { useMemo } from 'react';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import { createDisciplineColumns } from './disciplines/disciplineColumns';
import { Trophy, Plus, Search } from 'lucide-react';
import { useDisciplines, useDeleteDiscipline } from '@/hooks/useDisciplines';
import { useDebounce } from '@/hooks/useDebounce';
import type { Discipline } from '@/types';
import { DisciplineForm } from './components/DisciplineForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logError } from '@/lib/logger';

interface SearchFilters {
  search: string;
}

const EMPTY_FILTERS: SearchFilters = { search: '' };

export function DisciplinesAdminPage() {
  const crud = useCrudPageState<Discipline, SearchFilters>(EMPTY_FILTERS);
  const { filters, page, limit, editing: editingDiscipline, deleting: deletingDiscipline } = crud;
  const { search } = filters;
  const { openEdit, askDelete } = crud;

  // S06 — el endpoint NO devolvía el catálogo completo: devolvía las primeras
  // 20 (el default de `pagination.dto.ts`) y el filtrado local sólo alcanzaba a
  // esas. Ahora busca el backend (`DisciplineFilterDto` → `search`, sobre el
  // nombre) y la pantalla pagina.
  const debouncedSearch = useDebounce(search);

  const { data, isLoading, isFetching, isError, refetch } = useDisciplines({
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteDiscipline();

  // Tocar el filtro vuelve a la primera página: el resultado es otro y la
  // página en la que estabas puede ya no existir.
  const patchSearch = (value: string) => crud.patchFilters({ search: value });

  const handleDeleteConfirm = async () => {
    if (!deletingDiscipline) return;
    try {
      await deleteMutation.mutateAsync(deletingDiscipline.id);
      crud.cancelDelete();
    } catch (error) {
      logError('DisciplinesAdminPage.handleDeleteConfirm', error);
    }
  };

  // Memoizadas: sin esto el DataTable recibía columnas nuevas en cada render
  // (cada tecla en el buscador) y re-renderizaba todas las celdas.
  const columns = useMemo(() => createDisciplineColumns({ onEdit: openEdit, onDelete: askDelete }), [openEdit, askDelete]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disciplinas"
        description="Gestión de deportes y disciplinas de los Juegos Evita"
        icon={<Trophy className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={crud.openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Disciplina
          </Button>
        }
      />

      <DataTable
        entityName="disciplinas"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(discipline) => discipline.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRowInactive={(discipline) => !discipline.isActive}
        meta={data?.meta}
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={crud.clearFilters}
        emptyIcon={<Trophy className="w-10 h-10" />}
        emptyTitle="Todavía no hay disciplinas"
        emptyDescription="Registrá la primera disciplina para empezar a organizar torneos y categorías."
        emptyAction={
          <Button onClick={crud.openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Disciplina
          </Button>
        }
        toolbar={
          <div className="relative flex-1 md:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar por nombre..."
              aria-label="Buscar disciplinas"
              value={search}
              onChange={(e) => patchSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      <Dialog open={crud.isFormOpen} onOpenChange={crud.onFormOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingDiscipline ? 'Editar Disciplina' : 'Nueva Disciplina'}
            </DialogTitle>
          </DialogHeader>
          <DisciplineForm
            initialData={editingDiscipline}
            onSuccess={crud.closeForm}
            onCancel={crud.closeForm}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingDiscipline}
        title="¿Eliminar disciplina?"
        description={`¿Estás seguro de que deseas eliminar la disciplina "${deletingDiscipline?.name}"? Si contiene torneos o partidos registrados, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => crud.cancelDelete()}
      />
    </div>
  );
}

// ===========================================
// Disciplines Admin Page
// ===========================================
import { useState } from 'react';
import { Trophy, Plus, Pencil, Trash2, MoreVertical, Search } from 'lucide-react';
import { useDisciplines, useDeleteDiscipline } from '@/hooks/useDisciplines';
import { useDebounce } from '@/hooks/useDebounce';
import type { Discipline } from '@/types';
import { DisciplineType } from '@/types';
import { DisciplineForm } from './components/DisciplineForm';
import { DISCIPLINE_TYPE_LABELS, RESULT_TYPE_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { logError } from '@/lib/logger';

export function DisciplinesAdminPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | undefined>();
  const [deletingDiscipline, setDeletingDiscipline] = useState<Discipline | null>(null);

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
  const patchSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setPage(1);
  };

  const handleCreate = () => {
    setEditingDiscipline(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDiscipline(undefined);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDiscipline) return;
    try {
      await deleteMutation.mutateAsync(deletingDiscipline.id);
      setDeletingDiscipline(null);
    } catch (error) {
      logError('DisciplinesAdminPage.handleDeleteConfirm', error);
    }
  };

  const columns: DataTableColumn<Discipline>[] = [
    {
      id: 'name',
      header: 'Nombre',
      rowHeader: true,
      className: 'font-medium text-primary-900',
      headClassName: 'min-w-[180px]',
      cell: (discipline) => discipline.name,
    },
    {
      id: 'type',
      header: 'Tipo',
      cell: (discipline) => (
        // `variant="default"` y `variant="secondary"` no generan color:
        // `bg-primary` y `bg-secondary` no existen en el `@theme`. El tipo se
        // distingue con dos tonos de la paleta institucional que sí resuelven.
        <Badge
          variant="outline"
          className={
            discipline.type === DisciplineType.EQUIPO
              ? 'bg-primary-50 text-primary-700 border-primary-200'
              : 'bg-muted text-primary-700 border-primary-200'
          }
        >
          {DISCIPLINE_TYPE_LABELS[discipline.type]}
        </Badge>
      ),
    },
    {
      id: 'result',
      header: 'Resultado',
      cell: (discipline) => RESULT_TYPE_LABELS[discipline.resultType],
    },
    {
      id: 'players',
      header: 'Jugadores',
      cell: (discipline) => `${discipline.minPlayers} - ${discipline.maxPlayers}`,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (discipline) =>
        discipline.isActive ? (
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activo
          </Badge>
        ) : (
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
      cell: (discipline) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${discipline.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(discipline)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeletingDiscipline(discipline)}
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
        title="Disciplinas"
        description="Gestión de deportes y disciplinas de los Juegos Evita"
        icon={<Trophy className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
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
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={clearFilters}
        emptyIcon={<Trophy className="w-10 h-10" />}
        emptyTitle="Todavía no hay disciplinas"
        emptyDescription="Registrá la primera disciplina para empezar a organizar torneos y categorías."
        emptyAction={
          <Button onClick={handleCreate} className="gap-2">
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingDiscipline ? 'Editar Disciplina' : 'Nueva Disciplina'}
            </DialogTitle>
          </DialogHeader>
          <DisciplineForm
            initialData={editingDiscipline}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingDiscipline}
        title="¿Eliminar disciplina?"
        description={`¿Estás seguro de que deseas eliminar la disciplina "${deletingDiscipline?.name}"? Si contiene torneos o partidos registrados, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingDiscipline(null)}
      />
    </div>
  );
}

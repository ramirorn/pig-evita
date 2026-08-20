// ===========================================
// Teams Admin Page
// ===========================================
import { useState } from 'react';
import { UsersRound, Plus, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { useTeams, useDeleteTeam } from '@/hooks/useTeams';
import type { Team } from '@/types';
import { TeamForm } from './components/TeamForm';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logError } from '@/lib/logger';

export function TeamsAdminPage() {
  const [department, setDepartment] = useState('');
  const [locality, setLocality] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>();
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
  });

  const { data: teamsData, isLoading, isFetching, isError, refetch } = useTeams({
    department: department || undefined,
    locality: locality || undefined,
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteTeam();

  // El filtrado lo resuelve el backend, así que "hay filtros activos" es lo
  // único que el DataTable necesita saber para distinguir el vacío-por-filtro
  // del vacío-sin-datos.
  const hasActiveFilters =
    department.trim() !== '' ||
    locality.trim() !== '' ||
    disciplineId !== 'all' ||
    categoryId !== 'all';

  const clearFilters = () => {
    setDepartment('');
    setLocality('');
    setDisciplineId('all');
    setCategoryId('all');
    setPage(1);
  };

  const handleCreate = () => {
    setEditingTeam(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeam(undefined);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTeam) return;
    try {
      await deleteMutation.mutateAsync(deletingTeam.id);
      setDeletingTeam(null);
    } catch (error) {
      logError('TeamsAdminPage.handleDeleteConfirm', error);
    }
  };

  const columns: DataTableColumn<Team>[] = [
    {
      id: 'name',
      header: 'Nombre',
      // Columna de identidad: se renderiza como `<th scope="row">` y es donde
      // el DataTable ancla el link primario de la fila clickeable.
      rowHeader: true,
      headClassName: 'min-w-[200px]',
      cell: (team) => team.name,
    },
    {
      id: 'discipline',
      header: 'Disciplina',
      cell: (team) => team.discipline?.name || '—',
    },
    {
      id: 'category',
      header: 'Categoría',
      cell: (team) => team.category?.name || '—',
    },
    {
      id: 'location',
      header: 'Ubicación',
      cell: (team) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{team.department}</span>
          <span className="text-xs text-primary-500">{team.locality}</span>
        </div>
      ),
    },
    {
      id: 'members',
      header: 'Jugadores',
      cell: (team) => (
        // `variant="secondary"` no genera color (`bg-secondary` no existe en el
        // `@theme`): se usan tokens explícitos de la paleta institucional.
        <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
          {team._count?.members ?? team.members?.length ?? 0} /{' '}
          {team.discipline?.maxPlayers || '-'} Jugadores
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      // Celda con controles propios: se eleva sobre el overlay del link primario.
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (team) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Más acciones para ${team.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(team)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeletingTeam(team)}
              // `red-*` está fuera de la paleta institucional; `destructive-*` sí existe.
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
        title="Equipos"
        description="Gestión de equipos inscriptos y listas de buena fe"
        icon={<UsersRound className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Equipo
          </Button>
        }
      />

      <DataTable
        entityName="equipos"
        columns={columns}
        rows={teamsData?.data ?? []}
        getRowId={(team) => team.id}
        rowLink={(team) => ({ to: `/admin/equipos/${team.id}` })}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={teamsData?.meta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        emptyIcon={<UsersRound className="w-10 h-10" />}
        emptyTitle="Todavía no hay equipos"
        emptyDescription="Registrá el primer equipo para empezar a armar las listas de buena fe."
        emptyAction={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Equipo
          </Button>
        }
        toolbar={
          <>
            <Select
              value={disciplineId}
              onValueChange={(v) => {
                setDisciplineId(v);
                setCategoryId('all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-[220px]" aria-label="Filtrar por disciplina">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {disciplines?.data.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
              disabled={disciplineId === 'all'}
            >
              <SelectTrigger className="w-full md:w-[220px]" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories?.data.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar por departamento..."
              aria-label="Filtrar por departamento"
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-[200px]"
            />

            <Input
              placeholder="Buscar por localidad..."
              aria-label="Filtrar por localidad"
              value={locality}
              onChange={(e) => {
                setLocality(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-[200px]"
            />
          </>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}
            </DialogTitle>
          </DialogHeader>
          <TeamForm
            initialData={editingTeam}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        isOpen={!!deletingTeam}
        title="¿Eliminar equipo?"
        description={`¿Estás seguro de que deseas eliminar el equipo "${deletingTeam?.name}"? Si ya posee partidos o inscripciones jugadas, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTeam(null)}
      />
    </div>
  );
}

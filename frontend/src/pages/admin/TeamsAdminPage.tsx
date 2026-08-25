// ===========================================
// Teams Admin Page
// ===========================================
import { useState } from 'react';
import { UsersRound, Plus } from 'lucide-react';
import { useTeams, useDeleteTeam } from '@/hooks/useTeams';
import type { Team } from '@/types';
import { TeamForm } from './components/TeamForm';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermisos } from '@/hooks/usePermisos';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { createTeamColumns } from './teams/teamColumns';
import { TeamsToolbar } from './teams/TeamsToolbar';
import {
  EMPTY_TEAM_FILTERS,
  hasActiveTeamFilters,
  toTeamQuery,
  type TeamListFilters,
} from './teams/teamFilters';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logError } from '@/lib/logger';

export function TeamsAdminPage() {
  // R22 — COORDINADOR puede crear equipos y armar planteles, pero no editar ni
  // eliminar: el backend rechaza el PATCH y el DELETE.
  const { puede, puedeFiltrarPorDepartamento } = usePermisos();
  const [filters, setFilters] = useState<TeamListFilters>(EMPTY_TEAM_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>();
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
  });

  // Los dos filtros de texto se amortiguan antes de entrar a la `queryKey`
  // (R20): los `<input>` siguen atados a `filters` y responden sin retardo,
  // pero la request espera a que el usuario deje de tipear. Los `Select` no
  // pasan por el debounce: un click es una intención completa, no una ráfaga.
  const debouncedDepartment = useDebounce(filters.department);
  const debouncedLocality = useDebounce(filters.locality);

  const { data: teamsData, isLoading, isFetching, isError, refetch } = useTeams({
    ...toTeamQuery({
      ...filters,
      department: debouncedDepartment,
      locality: debouncedLocality,
    }),
    page,
    limit,
  });
  const deleteMutation = useDeleteTeam();

  // El filtrado lo resuelve el backend, así que "hay filtros activos" es lo
  // único que el DataTable necesita saber para distinguir el vacío-por-filtro
  // del vacío-sin-datos.
  const hasActiveFilters = hasActiveTeamFilters(filters);

  // Tocar cualquier filtro vuelve a la primera página: el resultado es otro y
  // la página en la que estabas puede ya no existir.
  const patchFilters = (patch: Partial<TeamListFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_TEAM_FILTERS);
    setPage(1);
  };

  const handleCreate = () => {
    setEditingTeam(undefined);
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

  const columns = createTeamColumns({
    onEdit: puede('TEAM_UPDATE')
      ? (team) => {
          setEditingTeam(team);
          setIsModalOpen(true);
        }
      : undefined,
    onDelete: puede('TEAM_DELETE') ? setDeletingTeam : undefined,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Equipos"
        description="Gestión de equipos inscriptos y listas de buena fe"
        icon={<UsersRound className="w-5 h-5 text-white" />}
        actions={
          puede('TEAM_CREATE') ? (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Equipo
            </Button>
          ) : undefined
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
          puede('TEAM_CREATE') ? (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Crear Equipo
            </Button>
          ) : undefined
        }
        toolbar={
          <TeamsToolbar
            filters={filters}
            onChange={patchFilters}
            mostrarFiltroDepartamento={puedeFiltrarPorDepartamento}
            disciplines={disciplines?.data ?? []}
            categories={categories?.data ?? []}
          />
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

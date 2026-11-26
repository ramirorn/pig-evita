// ===========================================
// Participants Admin Page
// ===========================================
import { useMemo } from 'react';
import { Users, Plus, Loader2 } from 'lucide-react';
import { useParticipant, useParticipants } from '@/hooks/useParticipants';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermisos } from '@/hooks/usePermisos';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import { ParticipantForm } from './components/ParticipantForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { createParticipantColumns } from './participants/participantColumns';
import { ParticipantsToolbar } from './participants/ParticipantsToolbar';
import {
  EMPTY_PARTICIPANT_FILTERS,
  hasActiveParticipantFilters,
  toParticipantQuery,
  type ParticipantListFilters,
} from './participants/participantFilters';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ParticipantsPage() {
  // R22 — el alta excluye a COORDINADOR y la edición además a ADMIN_ZONAL,
  // aunque los cuatro roles vean esta pantalla.
  const { puede, puedeFiltrarPorDepartamento } = usePermisos();
  // Se edita por id y no con la fila: el listado trae sólo las columnas de la tabla
  // (sin domicilio ni contacto), así que editar desde la fila borraba esos datos
  // al guardar. El form recibe el detalle completo (paso 1.8).
  const crud = useCrudPageState<string, ParticipantListFilters>(EMPTY_PARTICIPANT_FILTERS);
  const { filters, page, limit, editing: editingId } = crud;
  const {
    data: editingParticipant,
    isError: isDetailError,
    refetch: refetchDetail,
  } = useParticipant(editingId ?? '');

  // Los selectores del toolbar recorren la paginación hasta el final (S06):
  // con el hook paginado ofrecían como mucho 20 opciones.
  const { data: disciplines } = useAllDisciplines();
  const { data: categories } = useAllCategories({
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
  });

  // Los tres filtros de texto se amortiguan antes de entrar a la `queryKey`
  // (R20): los `<input>` siguen atados a `filters` y responden sin retardo,
  // pero la request espera a que el usuario deje de tipear. Los `Select` no
  // pasan por el debounce: un click es una intención completa, no una ráfaga.
  const debouncedSearch = useDebounce(filters.search);
  const debouncedDepartment = useDebounce(filters.department);
  const debouncedLocality = useDebounce(filters.locality);

  const { data: participantsData, isLoading, isFetching, isError, refetch } = useParticipants({
    ...toParticipantQuery({
      ...filters,
      search: debouncedSearch,
      department: debouncedDepartment,
      locality: debouncedLocality,
    }),
    page,
    limit,
  });

  // El backend resuelve el filtrado, así que "hay filtros activos" es lo único
  // que el DataTable necesita para distinguir el vacío-por-filtro (el usuario
  // buscó mal) del vacío-sin-datos (el padrón está vacío de verdad).
  const hasActiveFilters = hasActiveParticipantFilters(filters);

  // Sin permiso no se pasa el handler: la columna directamente no arma el menú
  // de acciones, en vez de mostrarlo deshabilitado. Memoizadas para no
  // re-renderizar todas las celdas en cada tecla de un filtro.
  const { openEdit } = crud;
  const columns = useMemo(
    () =>
      createParticipantColumns({
        onEdit: puede('PARTICIPANT_UPDATE') ? (participant) => openEdit(participant.id) : undefined,
      }),
    [puede, openEdit],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Participantes"
        description="Padrón único de deportistas y entrenadores"
        icon={<Users className="w-5 h-5 text-white" />}
        actions={
          puede('PARTICIPANT_CREATE') ? (
            <Button onClick={crud.openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Participante
            </Button>
          ) : undefined
        }
      />

      <DataTable
        entityName="participantes"
        columns={columns}
        rows={participantsData?.data ?? []}
        getRowId={(participant) => participant.id}
        // El texto visible del link es el DNI; el nombre accesible es la
        // persona, para que el lector no anuncie "enlace, 20304050".
        rowLink={(participant) => ({
          to: `/admin/participantes/${participant.id}`,
          label: `${participant.lastName}, ${participant.firstName}`,
        })}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={participantsData?.meta}
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={crud.clearFilters}
        emptyIcon={<Users className="w-10 h-10" />}
        emptyTitle="Todavía no hay participantes"
        emptyDescription="Registrá al primer deportista o entrenador para empezar a armar el padrón."
        emptyAction={
          puede('PARTICIPANT_CREATE') ? (
            <Button onClick={crud.openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Crear Participante
            </Button>
          ) : undefined
        }
        toolbar={
          <ParticipantsToolbar
            filters={filters}
            onChange={crud.patchFilters}
            mostrarFiltroDepartamento={puedeFiltrarPorDepartamento}
            disciplines={disciplines ?? []}
            categories={categories ?? []}
          />
        }
      />

      <Dialog open={crud.isFormOpen} onOpenChange={crud.onFormOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Participante' : 'Nuevo Participante'}
            </DialogTitle>
          </DialogHeader>
          {editingId && isDetailError ? (
            <div className="space-y-3 py-6 text-center" role="alert">
              <p className="text-sm text-primary-700">No se pudo cargar el participante.</p>
              <Button variant="outline" onClick={() => void refetchDetail()}>
                Reintentar
              </Button>
            </div>
          ) : editingId && !editingParticipant ? (
            <div className="flex justify-center py-10" role="status" aria-label="Cargando participante">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <ParticipantForm
              initialData={editingId ? editingParticipant : undefined}
              onSuccess={crud.closeForm}
              onCancel={crud.closeForm}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

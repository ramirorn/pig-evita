// ===========================================
// Venues Admin Page
// ===========================================
import { useMemo } from 'react';
import { Building2, MapPin, Plus } from 'lucide-react';
import { useVenues, useDeleteVenue } from '@/hooks/useVenues';
import { useDebounce } from '@/hooks/useDebounce';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import type { Venue } from '@/types';
import { createVenueColumns } from './venues/venueColumns';
import { VenueFormDialog } from './venues/VenueFormDialog';
import { VenuesToolbar } from './venues/VenuesToolbar';
import {
  EMPTY_VENUE_FILTERS,
  hasActiveVenueFilters,
  toVenueQuery,
  type VenueListFilters,
} from './venues/venueFilters';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logError } from '@/lib/logger';

export function VenuesAdminPage() {
  const crud = useCrudPageState<Venue, VenueListFilters>(EMPTY_VENUE_FILTERS);
  const { filters, page, limit, editing: editingVenue, deleting: deletingVenue } = crud;

  // El buscador se amortigua antes de entrar a la `queryKey` (R20); los
  // `Select` no, porque un click es una intención completa y no una ráfaga.
  const debouncedSearch = useDebounce(filters.search);

  const { data: venuesData, isLoading, isFetching, isError, refetch } = useVenues({
    ...toVenueQuery({ ...filters, search: debouncedSearch }),
    page,
    limit,
  });
  const deleteMutation = useDeleteVenue();

  // El backend resuelve el filtrado, así que "hay filtros activos" es lo único
  // que el DataTable necesita para distinguir el vacío-por-filtro del
  // vacío-sin-datos.
  const hasActiveFilters = hasActiveVenueFilters(filters);

  const handleConfirmDelete = async () => {
    if (!deletingVenue) return;
    try {
      await deleteMutation.mutateAsync(deletingVenue.id);
      crud.cancelDelete();
    } catch (error) {
      logError('VenuesAdminPage.handleConfirmDelete', error);
    }
  };

  // Memoizadas: sin esto el DataTable recibía columnas nuevas en cada render.
  const { openEdit, askDelete } = crud;
  const columns = useMemo(
    () => createVenueColumns({ onEdit: openEdit, onDelete: askDelete }),
    [openEdit, askDelete],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sedes de Competencia"
        description="Gestión de polideportivos, clubes, estadios y complejos deportivos"
        icon={<MapPin className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={crud.openCreate} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Nueva Sede
          </Button>
        }
      />

      <DataTable
        entityName="sedes"
        columns={columns}
        rows={venuesData?.data ?? []}
        getRowId={(venue) => venue.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRowInactive={(venue) => !venue.isActive}
        meta={venuesData?.meta}
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={crud.clearFilters}
        emptyIcon={<Building2 className="w-10 h-10" />}
        emptyTitle="Todavía no hay sedes"
        emptyDescription="Registrá la primera sede deportiva para empezar a programar partidos y eventos."
        emptyAction={
          <Button onClick={crud.openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar Sede
          </Button>
        }
        toolbar={
          <VenuesToolbar filters={filters} onChange={crud.patchFilters} />
        }
      />

      {/* Modal Crear Sede */}
      <VenueFormDialog open={crud.isFormOpen && !editingVenue} onOpenChange={crud.onFormOpenChange} />

      {/* Modal Editar Sede */}
      <VenueFormDialog
        open={crud.isFormOpen && !!editingVenue}
        venue={editingVenue}
        onOpenChange={crud.onFormOpenChange}
      />

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteDialog
        open={!!deletingVenue}
        onOpenChange={(open) => !open && crud.cancelDelete()}
        title="¿Eliminar Sede?"
        itemName={deletingVenue?.name}
        description="Si la sede tiene partidos o eventos asignados, se desactivará para preservar el historial. De lo contrario, se eliminará permanentemente."
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

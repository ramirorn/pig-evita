// ===========================================
// Venues Admin Page
// ===========================================
import { useMemo, useState } from 'react';
import { Building2, MapPin, Plus } from 'lucide-react';
import { useVenues, useDeleteVenue } from '@/hooks/useVenues';
import type { Venue } from '@/types';
import { createVenueColumns } from './venues/venueColumns';
import { VenueFormDialog } from './venues/VenueFormDialog';
import { VenuesToolbar } from './venues/VenuesToolbar';
import {
  EMPTY_VENUE_FILTERS,
  filterVenues,
  hasActiveVenueFilters,
  type VenueListFilters,
} from './venues/venueFilters';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logError } from '@/lib/logger';

export function VenuesAdminPage() {
  const [filters, setFilters] = useState<VenueListFilters>(EMPTY_VENUE_FILTERS);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState<Venue | null>(null);

  const { data: venuesData, isLoading, isFetching, isError, refetch } = useVenues();
  const deleteMutation = useDeleteVenue();

  const hasActiveFilters = hasActiveVenueFilters(filters);
  const filtered = useMemo(() => filterVenues(venuesData?.data ?? [], filters), [venuesData, filters]);

  const handleConfirmDelete = async () => {
    if (!deletingVenue) return;
    try {
      await deleteMutation.mutateAsync(deletingVenue.id);
      setDeletingVenue(null);
    } catch (error) {
      logError('VenuesAdminPage.handleConfirmDelete', error);
    }
  };

  const columns = createVenueColumns({ onEdit: setEditingVenue, onDelete: setDeletingVenue });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sedes de Competencia"
        description="Gestión de polideportivos, clubes, estadios y complejos deportivos"
        icon={<MapPin className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Nueva Sede
          </Button>
        }
      />

      <DataTable
        entityName="sedes"
        columns={columns}
        rows={filtered}
        getRowId={(venue) => venue.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRowInactive={(venue) => !venue.isActive}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => setFilters(EMPTY_VENUE_FILTERS)}
        emptyIcon={<Building2 className="w-10 h-10" />}
        emptyTitle="Todavía no hay sedes"
        emptyDescription="Registrá la primera sede deportiva para empezar a programar partidos y eventos."
        emptyAction={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar Sede
          </Button>
        }
        toolbar={
          <VenuesToolbar
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          />
        }
      />

      {/* Modal Crear Sede */}
      <VenueFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Modal Editar Sede */}
      <VenueFormDialog
        open={!!editingVenue}
        venue={editingVenue}
        onOpenChange={(open) => !open && setEditingVenue(null)}
      />

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteDialog
        open={!!deletingVenue}
        onOpenChange={(open) => !open && setDeletingVenue(null)}
        title="¿Eliminar Sede?"
        itemName={deletingVenue?.name}
        description="Si la sede tiene partidos o eventos asignados, se desactivará para preservar el historial. De lo contrario, se eliminará permanentemente."
        onConfirm={handleConfirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

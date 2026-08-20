// ===========================================
// Venues Admin Page
// ===========================================
import { useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  ExternalLink,
  Users,
  Building2,
} from 'lucide-react';
import { useVenues, useDeleteVenue } from '@/hooks/useVenues';
import type { Venue } from '@/types';
import { VenueForm } from './components/VenueForm';
import { safeExternalUrl } from '@/lib/utils';

/** Base fija de Google Maps: nunca se arma con datos del backend. */
const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logError } from '@/lib/logger';

const FORMOSA_DEPARTMENTS = [
  'Formosa',
  'Pilcomayo',
  'Pirané',
  'Patiño',
  'Pilagás',
  'Bermejo',
  'Matacos',
  'Ramón Lista',
  'Laishí',
];

export function VenuesAdminPage() {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [deletingVenue, setDeletingVenue] = useState<Venue | null>(null);

  const { data: venuesData, isLoading, isFetching, isError, refetch } = useVenues();
  const deleteMutation = useDeleteVenue();

  const hasActiveFilters =
    search.trim() !== '' || departmentFilter !== 'all' || statusFilter !== 'all';

  const filtered = useMemo(
    () =>
      (venuesData?.data ?? []).filter((v) => {
        const needle = search.toLowerCase();
        const matchesSearch =
          v.name.toLowerCase().includes(needle) ||
          v.locality.toLowerCase().includes(needle) ||
          v.department.toLowerCase().includes(needle) ||
          (v.address ?? '').toLowerCase().includes(needle);

        const matchesDept =
          departmentFilter === 'all' ||
          v.department.toLowerCase() === departmentFilter.toLowerCase();

        const matchesStatus =
          statusFilter === 'all' || (statusFilter === 'active' ? v.isActive : !v.isActive);

        return matchesSearch && matchesDept && matchesStatus;
      }),
    [venuesData, search, departmentFilter, statusFilter],
  );

  const clearFilters = () => {
    setSearch('');
    setDepartmentFilter('all');
    setStatusFilter('all');
  };

  const handleConfirmDelete = async () => {
    if (!deletingVenue) return;
    try {
      await deleteMutation.mutateAsync(deletingVenue.id);
      setDeletingVenue(null);
    } catch (error) {
      logError('VenuesAdminPage.handleConfirmDelete', error);
    }
  };

  const columns: DataTableColumn<Venue>[] = [
    {
      id: 'venue',
      header: 'Sede / Instalación',
      rowHeader: true,
      headClassName: 'min-w-[220px]',
      cell: (venue) => (
        <div>
          <p className="font-semibold text-primary-900 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
            {venue.name}
          </p>
          {venue.address && (
            <p className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary-400 shrink-0" aria-hidden="true" />
              {venue.address}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Ubicación',
      headClassName: 'min-w-[160px]',
      cell: (venue) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary-800">{venue.locality}</p>
          <Badge
            variant="outline"
            className="text-[11px] bg-white text-primary-600 border-primary-200"
          >
            Dpto. {venue.department}
          </Badge>
        </div>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacidad',
      headClassName: 'min-w-[120px]',
      cell: (venue) =>
        venue.capacity ? (
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-100">
            <Users className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
            {venue.capacity.toLocaleString('es-AR')} personas
          </div>
        ) : (
          // `primary-400` daba 3.75:1 sobre blanco (falla AA); `primary-500` da 6.52:1.
          <span className="text-xs text-primary-500 italic">Sin especificar</span>
        ),
    },
    {
      id: 'status',
      header: 'Estado',
      headClassName: 'min-w-[100px]',
      cell: (venue) =>
        venue.isActive ? (
          // `emerald-*` y `gray-*` no pertenecen a la paleta institucional.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activa
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Inactiva
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[100px] text-right',
      className: 'text-right',
      cell: (venue) => {
        // `address` y `locality` son texto libre del backend: si el helper
        // no puede armar una URL https limpia, el item del menú no se muestra.
        const mapsUrl = safeExternalUrl(MAPS_SEARCH_BASE, {
          api: '1',
          query: `${venue.name} ${venue.address ?? ''} ${venue.locality ?? ''} Formosa`,
        });

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-600 hover:text-primary-900 hover:bg-primary-100"
              onClick={() => setEditingVenue(venue)}
              aria-label={`Editar ${venue.name}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-600 hover:text-primary-900 hover:bg-primary-100"
                  aria-label={`Más acciones para ${venue.name}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => setEditingVenue(venue)}
                  className="gap-2 text-primary-800"
                >
                  <Pencil className="w-4 h-4 text-primary-600" />
                  Editar Sede
                </DropdownMenuItem>

                {mapsUrl && (
                  <DropdownMenuItem asChild className="gap-2 text-primary-800">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4 text-primary-600" />
                      Ver en Google Maps
                    </a>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => setDeletingVenue(venue)}
                  // `text-destructive` a secas no existe en el `@theme`: no se genera.
                  className="gap-2 text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Sede
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

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
        onClearFilters={clearFilters}
        emptyIcon={<Building2 className="w-10 h-10" />}
        emptyTitle="Todavía no hay sedes"
        emptyDescription="Registrá la primera sede deportiva para empezar a programar partidos y eventos."
        emptyAction={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Registrar Sede
          </Button>
        }
        toolbar={
          <>
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por sede, dirección o localidad..."
                aria-label="Buscar sedes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger
                  className="w-full sm:w-[180px] bg-white"
                  aria-label="Filtrar por departamento"
                >
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los departamentos</SelectItem>
                  {FORMOSA_DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as 'all' | 'active' | 'inactive')}
              >
                <SelectTrigger
                  className="w-full sm:w-[140px] bg-white"
                  aria-label="Filtrar por estado"
                >
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        }
      />

      {/* Modal Crear Sede */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              Nueva Sede de Competencia
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-500">
              Registrá una nueva instalación deportiva para alojar disciplinas y eventos.
            </DialogDescription>
          </DialogHeader>

          <VenueForm
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Editar Sede */}
      <Dialog open={!!editingVenue} onOpenChange={(open) => !open && setEditingVenue(null)}>
        <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary-600" />
              Editar Sede
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-500">
              Modificá los datos y la ubicación de {editingVenue?.name}.
            </DialogDescription>
          </DialogHeader>

          {editingVenue && (
            <VenueForm
              initialData={editingVenue}
              onSuccess={() => setEditingVenue(null)}
              onCancel={() => setEditingVenue(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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

// ===========================================
// Venues Admin Page
// ===========================================
import { useState } from 'react';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
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

  const { data: venuesData, isLoading } = useVenues();
  const deleteMutation = useDeleteVenue();

  const filtered = (venuesData?.data || []).filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.locality.toLowerCase().includes(search.toLowerCase()) ||
      v.department.toLowerCase().includes(search.toLowerCase()) ||
      (v.address && v.address.toLowerCase().includes(search.toLowerCase()));

    const matchesDept =
      departmentFilter === 'all' ||
      v.department.toLowerCase() === departmentFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? v.isActive : !v.isActive);

    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleDeleteClick = (venue: Venue) => {
    setDeletingVenue(venue);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sedes de Competencia"
        description="Gestión de polideportivos, clubes, estadios y complejos deportivos"
        icon={<MapPin className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 cursor-pointer shadow-sm">
            <Plus className="w-4 h-4" />
            Nueva Sede
          </Button>
        }
      />

      <div className="card shadow-xs">
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-primary-100 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input
              placeholder="Buscar por sede, dirección o localidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Filtro por Departamento */}
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="w-full sm:w-[180px] bg-white">
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

            {/* Filtro por Estado */}
            <Select
              value={statusFilter}
              onValueChange={(val: any) => setStatusFilter(val)}
            >
              <SelectTrigger className="w-full sm:w-[140px] bg-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla de Sedes */}
        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-10 h-10 text-primary-400" />}
              title="No se encontraron sedes"
              description={
                search || departmentFilter !== 'all' || statusFilter !== 'all'
                  ? 'Prueba modificando los filtros o el texto de búsqueda.'
                  : 'Registra la primera sede deportiva para comenzar a programar partidos y eventos.'
              }
              action={
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" /> Registrar Sede
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Sede / Instalación</TableHead>
                  <TableHead className="min-w-[160px]">Ubicación</TableHead>
                  <TableHead className="min-w-[120px]">Capacidad</TableHead>
                  <TableHead className="min-w-[100px]">Estado</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((venue) => {
                  const mapQuery = encodeURIComponent(`${venue.name} ${venue.address} ${venue.locality} Formosa`);
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

                  return (
                    <TableRow key={venue.id} className="hover:bg-primary-50/50 transition-colors">
                      {/* Nombre y Dirección */}
                      <TableCell className="font-medium text-primary-900">
                        <div>
                          <p className="font-semibold text-primary-950 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-primary-600 shrink-0" />
                            {venue.name}
                          </p>
                          {venue.address && (
                            <p className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-primary-400 shrink-0" />
                              {venue.address}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Ubicación */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-primary-800">{venue.locality}</p>
                          <Badge variant="outline" className="text-[11px] bg-white text-primary-600 border-primary-200">
                            Dpto. {venue.department}
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Capacidad */}
                      <TableCell>
                        {venue.capacity ? (
                          <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-100">
                            <Users className="w-3.5 h-3.5 text-primary-500" />
                            {venue.capacity.toLocaleString('es-AR')} personas
                          </div>
                        ) : (
                          <span className="text-xs text-primary-400">Sin especificar</span>
                        )}
                      </TableCell>

                      {/* Estado */}
                      <TableCell>
                        {venue.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            Inactiva
                          </span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary-600 hover:text-primary-900 hover:bg-primary-100 cursor-pointer"
                            onClick={() => setEditingVenue(venue)}
                            title="Editar sede"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary-600 hover:text-primary-900 hover:bg-primary-100 cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => setEditingVenue(venue)}
                                className="gap-2 cursor-pointer text-primary-800"
                              >
                                <Pencil className="w-4 h-4 text-primary-600" />
                                Editar Sede
                              </DropdownMenuItem>

                              <DropdownMenuItem asChild className="gap-2 cursor-pointer text-primary-800">
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

                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(venue)}
                                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar Sede
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modal Crear Sede */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-950 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-600" />
              Nueva Sede de Competencia
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-500">
              Registra una nueva instalación deportiva para alojar disciplinas y eventos.
            </DialogDescription>
          </DialogHeader>

          <VenueForm
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Editar Sede */}
      <Dialog
        open={!!editingVenue}
        onOpenChange={(open) => !open && setEditingVenue(null)}
      >
        <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-950 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary-600" />
              Editar Sede
            </DialogTitle>
            <DialogDescription className="text-xs text-primary-500">
              Modifica los datos y ubicación de {editingVenue?.name}.
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

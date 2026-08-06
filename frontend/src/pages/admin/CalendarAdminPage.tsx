// ===========================================
// Calendar Admin Page
// ===========================================
import { useState } from 'react';
import {
  CalendarDays,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  MapPin,
  Trophy,
} from 'lucide-react';
import { useCalendarEvents, useDeleteCalendarEvent } from '@/hooks/useCalendar';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useVenues } from '@/hooks/useVenues';
import type { CalendarEvent } from '@/types';
import { CalendarEventForm } from './components/CalendarEventForm';
import { STAGE_LABELS } from '@/lib/constants';

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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

export function CalendarAdminPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | undefined>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: calendarData, isLoading } = useCalendarEvents();
  const { data: disciplinesData } = useDisciplines();
  const { data: venuesData } = useVenues();
  const deleteMutation = useDeleteCalendarEvent();

  // Helper maps for fast lookup
  const disciplinesMap = new Map((disciplinesData?.data || []).map((d) => [d.id, d.name]));
  const venuesMap = new Map((venuesData?.data || []).map((v) => [v.id, `${v.name} (${v.locality})`]));

  const filtered = (calendarData?.data || []).filter((item) =>
    !search ||
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = () => {
    setEditingEvent(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (event: CalendarEvent) => {
    setEventToDelete(event);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (eventToDelete) {
      await deleteMutation.mutateAsync(eventToDelete.id);
      setIsDeleteDialogOpen(false);
      setEventToDelete(undefined);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(undefined);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Calendario"
        description="Gestión de eventos, cronograma y programación deportiva"
        icon={<CalendarDays className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Crear Evento
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar evento por título o descripción..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-10 h-10" />}
              title="Sin eventos en calendario"
              description="No hay eventos programados en el calendario."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Evento
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Disciplina / Sede</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const disciplineName = item.disciplineId ? disciplinesMap.get(item.disciplineId) : null;
                  const venueName = item.venueId ? venuesMap.get(item.venueId) : null;

                  return (
                    <TableRow key={item.id} className="hover:bg-primary-50/50">
                      <TableCell className="font-medium text-primary-900">
                        <div>
                          <p className="font-semibold text-primary-900">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-primary-500 line-clamp-1 mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-primary-600 text-sm">
                        <div>
                          <span className="font-medium text-primary-800">
                            {new Date(item.startDate).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {item.endDate && (
                            <p className="text-xs text-primary-400">
                              Hasta:{' '}
                              {new Date(item.endDate).toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.stage ? (
                          <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-800 border-primary-200">
                            {STAGE_LABELS[item.stage] || item.stage}
                          </Badge>
                        ) : (
                          <span className="text-primary-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-primary-600 space-y-1">
                        {disciplineName && (
                          <div className="flex items-center gap-1 text-primary-700">
                            <Trophy className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                            <span className="font-medium">{disciplineName}</span>
                          </div>
                        )}
                        {venueName && (
                          <div className="flex items-center gap-1 text-primary-500">
                            <MapPin className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                            <span>{venueName}</span>
                          </div>
                        )}
                        {!disciplineName && !venueName && <span className="text-primary-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {item.isPublished ? (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs">
                            Publicado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-neutral-500 bg-neutral-100 border-neutral-200 text-xs">
                            Borrador
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-primary-500 hover:text-primary-900">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)} className="gap-2 cursor-pointer">
                              <Pencil className="w-4 h-4 text-primary-600" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(item)}
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modal Crear / Editar Evento */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Editar Evento del Calendario' : 'Crear Nuevo Evento'}
            </DialogTitle>
          </DialogHeader>
          <CalendarEventForm
            key={editingEvent?.id || 'new-calendar-event'}
            initialData={editingEvent}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="¿Eliminar evento del calendario?"
        itemName={eventToDelete?.title}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}

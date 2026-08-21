// ===========================================
// Calendar Admin Page
// ===========================================
import { useMemo, useState } from 'react';
import { CalendarDays, Search, Plus } from 'lucide-react';
import { useCalendarEvents, useDeleteCalendarEvent } from '@/hooks/useCalendar';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useVenues } from '@/hooks/useVenues';
import type { CalendarEvent } from '@/types';
import { CalendarEventForm } from './components/CalendarEventForm';
import { CalendarEventsTable } from './calendar/CalendarEventsTable';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
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

  // Índices para resolver nombres de disciplina/sede por id.
  //
  // Se memoizan porque lo que dispara los re-renders de esta página NO es lo que
  // alimenta a estos mapas: `search` cambia en cada tecleo y el estado de los
  // diálogos en cada apertura, mientras que `disciplinesData`/`venuesData`
  // vienen del cache de React Query y son referencialmente estables. Sin
  // `useMemo` se reconstruían dos `Map` completos por cada letra tipeada.
  const disciplinesMap = useMemo(
    () => new Map((disciplinesData?.data ?? []).map((d) => [d.id, d.name])),
    [disciplinesData],
  );
  const venuesMap = useMemo(
    () => new Map((venuesData?.data ?? []).map((v) => [v.id, `${v.name} (${v.locality})`])),
    [venuesData],
  );

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

        <CalendarEventsTable
          events={filtered}
          isLoading={isLoading}
          disciplinesMap={disciplinesMap}
          venuesMap={venuesMap}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />
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

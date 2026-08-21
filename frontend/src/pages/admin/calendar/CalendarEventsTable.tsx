// ===========================================
// CalendarEventsTable — tabla de eventos del calendario (admin)
// ===========================================
import { CalendarDays, Plus } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { CalendarEventRow } from './CalendarEventRow';

interface CalendarEventsTableProps {
  /** Ya filtrados por la página. */
  events: CalendarEvent[];
  isLoading: boolean;
  /** Índices id → nombre para resolver disciplina y sede sin re-consultar. */
  disciplinesMap: Map<string, string>;
  venuesMap: Map<string, string>;
  onCreate: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}

export function CalendarEventsTable({
  events,
  isLoading,
  disciplinesMap,
  venuesMap,
  onCreate,
  onEdit,
  onDelete,
}: CalendarEventsTableProps) {
  return (
    <div className="relative">
      {isLoading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-10 h-10" />}
          title="Sin eventos en calendario"
          description="No hay eventos programados en el calendario."
          action={
            <Button onClick={onCreate} className="gap-2">
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
            {events.map((item) => (
              <CalendarEventRow
                key={item.id}
                event={item}
                disciplineName={(item.disciplineId ? disciplinesMap.get(item.disciplineId) : null) ?? null}
                venueName={(item.venueId ? venuesMap.get(item.venueId) : null) ?? null}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

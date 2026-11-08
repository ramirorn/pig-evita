// ===========================================
// CalendarEventsTable — tabla de eventos del calendario (admin)
// ===========================================
import type { ReactNode } from 'react';
import { CalendarDays, MapPin, MoreVertical, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { STAGE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';

interface CalendarEventsTableProps {
  /** Ya filtrados por la página. */
  events: CalendarEvent[];
  isLoading: boolean;
  /** Índices id → nombre para resolver disciplina y sede sin re-consultar. */
  disciplinesMap: Map<string, string>;
  venuesMap: Map<string, string>;
  /** Buscador (y filtros, si los hubiera) que la página dibuja arriba de la tabla. */
  toolbar?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onCreate: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}

const FECHA_CON_HORA: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const FECHA_FIN: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

export function CalendarEventsTable({
  events,
  isLoading,
  disciplinesMap,
  venuesMap,
  toolbar,
  hasActiveFilters,
  onClearFilters,
  onCreate,
  onEdit,
  onDelete,
}: CalendarEventsTableProps) {
  const columns: DataTableColumn<CalendarEvent>[] = [
    {
      id: 'event',
      header: 'Evento',
      rowHeader: true,
      mobile: 'primary',
      headClassName: 'min-w-[220px]',
      cell: (event) => (
        <div>
          <p className="font-semibold text-primary-900">{event.title}</p>
          {event.description && (
            <p className="text-xs text-primary-500 line-clamp-1 mt-0.5">{event.description}</p>
          )}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Fecha y Hora',
      mobile: 'secondary',
      className: 'text-primary-600 text-sm tabular-nums',
      cell: (event) => (
        <div>
          <span className="font-medium text-primary-800">
            {new Date(event.startDate).toLocaleDateString('es-AR', FECHA_CON_HORA)}
          </span>
          {event.endDate && (
            <p className="text-xs text-primary-500">
              Hasta: {new Date(event.endDate).toLocaleDateString('es-AR', FECHA_FIN)}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'stage',
      header: 'Etapa',
      mobile: 'secondary',
      cell: (event) =>
        event.stage ? (
          <Badge
            variant="secondary"
            className="text-xs bg-primary-100 text-primary-800 border-primary-200"
          >
            {STAGE_LABELS[event.stage] || event.stage}
          </Badge>
        ) : (
          <span className="text-primary-500 text-xs">—</span>
        ),
    },
    {
      id: 'place',
      header: 'Disciplina / Sede',
      mobile: 'secondary',
      className: 'text-xs text-primary-600',
      cell: (event) => {
        const disciplineName =
          (event.disciplineId ? disciplinesMap.get(event.disciplineId) : null) ?? null;
        const venueName = (event.venueId ? venuesMap.get(event.venueId) : null) ?? null;
        return (
          <div className="space-y-1">
            {disciplineName && (
              <div className="flex items-center gap-1 text-primary-700">
                <Trophy className="w-3.5 h-3.5 text-primary-500 shrink-0" aria-hidden="true" />
                <span className="font-medium">{disciplineName}</span>
              </div>
            )}
            {venueName && (
              <div className="flex items-center gap-1 text-primary-600">
                <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" aria-hidden="true" />
                <span>{venueName}</span>
              </div>
            )}
            {!disciplineName && !venueName && <span className="text-primary-500">—</span>}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Estado',
      mobile: 'secondary',
      cell: (event) =>
        event.isPublished ? (
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200 text-xs"
          >
            Publicado
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200 text-xs">
            Borrador
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      mobile: 'actions',
      headClassName: 'w-[80px] text-right',
      className: 'text-right',
      cell: (event) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-600 hover:text-primary-900 hover:bg-primary-50"
              // F-36: sin nombre accesible el lector anunciaba "botón" a secas.
              aria-label={`Más acciones para ${event.title}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(event)} className="gap-2 cursor-pointer">
              <Pencil className="w-4 h-4 text-primary-600" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(event)}
              className="gap-2 cursor-pointer text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      entityName="eventos del calendario"
      columns={columns}
      rows={events}
      getRowId={(event) => event.id}
      isLoading={isLoading}
      toolbar={toolbar}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={onClearFilters}
      emptyIcon={<CalendarDays className="w-10 h-10" />}
      emptyTitle="Sin eventos en calendario"
      emptyDescription="No hay eventos programados en el calendario."
      emptyAction={
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Crear Evento
        </Button>
      }
    />
  );
}

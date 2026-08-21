// ===========================================
// CalendarEventRow — fila del listado de eventos del calendario
// ===========================================
import { MapPin, MoreVertical, Pencil, Trash2, Trophy } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { STAGE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CalendarEventRowProps {
  event: CalendarEvent;
  /** Ya resueltos por la página desde los índices por id; `null` si el evento no tiene. */
  disciplineName: string | null;
  venueName: string | null;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
}

export function CalendarEventRow({
  event,
  disciplineName,
  venueName,
  onEdit,
  onDelete,
}: CalendarEventRowProps) {
  return (
    <TableRow className="hover:bg-primary-50/50">
      <TableCell className="font-medium text-primary-900">
        <div>
          <p className="font-semibold text-primary-900">{event.title}</p>
          {event.description && (
            <p className="text-xs text-primary-500 line-clamp-1 mt-0.5">{event.description}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-primary-600 text-sm">
        <div>
          <span className="font-medium text-primary-800">
            {new Date(event.startDate).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {event.endDate && (
            <p className="text-xs text-primary-400">
              Hasta:{' '}
              {new Date(event.endDate).toLocaleDateString('es-AR', {
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
        {event.stage ? (
          <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-800 border-primary-200">
            {STAGE_LABELS[event.stage] || event.stage}
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
        {event.isPublished ? (
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
            <DropdownMenuItem onClick={() => onEdit(event)} className="gap-2 cursor-pointer">
              <Pencil className="w-4 h-4 text-primary-600" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(event)}
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
}

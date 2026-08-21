// ===========================================
// participantColumns — columnas de la tabla del padrón
// ===========================================
import { MoreVertical, Pencil } from 'lucide-react';
import type { Participant } from '@/types';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { SEX_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ParticipantColumnActions {
  onEdit: (participant: Participant) => void;
}

/**
 * Cómo se ve un participante dentro de la tabla. Lo único que necesita de la
 * página es qué hacer al editar, así que se define acá y la página queda con el
 * layout y el estado de filtros.
 */
export function createParticipantColumns({
  onEdit,
}: ParticipantColumnActions): DataTableColumn<Participant>[] {
  return [
    {
      id: 'dni',
      header: 'DNI',
      // Columna de identidad: va como `<th scope="row">` y ancla el link
      // primario que cubre la fila entera.
      rowHeader: true,
      className: 'font-mono',
      headClassName: 'min-w-[120px]',
      cell: (participant) => participant.dni,
    },
    {
      id: 'name',
      header: 'Apellido y Nombre',
      headClassName: 'min-w-[200px]',
      cell: (participant) => (
        <>
          <span className="font-semibold text-primary-900">{participant.lastName}</span>,{' '}
          {participant.firstName}
        </>
      ),
    },
    {
      id: 'sex-birth',
      header: 'Sexo / F. Nacimiento',
      cell: (participant) => (
        <div className="flex flex-col text-sm">
          <span>{SEX_LABELS[participant.sex]}</span>
          <span className="text-primary-500">
            {new Date(participant.birthDate).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Ubicación',
      cell: (participant) => (
        <div className="flex flex-col text-sm">
          <span>{participant.department}</span>
          <span className="text-primary-500">{participant.locality}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      // Celda con controles propios: se eleva sobre el overlay del link primario.
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (participant) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // Antes era un botón sin nombre accesible: el lector anunciaba
              // "botón" a secas, una vez por fila.
              aria-label={`Más acciones para ${participant.lastName}, ${participant.firstName}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(participant)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

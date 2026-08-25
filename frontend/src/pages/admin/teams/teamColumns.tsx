// ===========================================
// teamColumns — definición de las columnas de la tabla de equipos
// ===========================================
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { Team } from '@/types';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamColumnActions {
  /**
   * Handlers **opcionales** (R22): `TEAM_UPDATE` y `TEAM_DELETE` excluyen a
   * `COORDINADOR`, que sí ve esta pantalla. Si la página no los pasa, el ítem
   * correspondiente no se dibuja; si no queda ninguno, tampoco la columna.
   */
  onEdit?: (team: Team) => void;
  onDelete?: (team: Team) => void;
}

/**
 * Cómo se ve un equipo dentro de la tabla. Es la mitad más larga de la página y
 * lo único que necesita de ella es qué hacer al editar o eliminar, así que se
 * define acá y la página queda con el layout y el estado de filtros.
 */
export function createTeamColumns({
  onEdit,
  onDelete,
}: TeamColumnActions): DataTableColumn<Team>[] {
  const columnas: DataTableColumn<Team>[] = [
    {
      id: 'name',
      header: 'Nombre',
      // Columna de identidad: se renderiza como `<th scope="row">` y es donde
      // el DataTable ancla el link primario de la fila clickeable.
      rowHeader: true,
      headClassName: 'min-w-[200px]',
      cell: (team) => team.name,
    },
    {
      id: 'discipline',
      header: 'Disciplina',
      cell: (team) => team.discipline?.name || '—',
    },
    {
      id: 'category',
      header: 'Categoría',
      cell: (team) => team.category?.name || '—',
    },
    {
      id: 'location',
      header: 'Ubicación',
      cell: (team) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{team.department}</span>
          <span className="text-xs text-primary-500">{team.locality}</span>
        </div>
      ),
    },
    {
      id: 'members',
      header: 'Jugadores',
      cell: (team) => (
        // `variant="secondary"` no genera color (`bg-secondary` no existe en el
        // `@theme`): se usan tokens explícitos de la paleta institucional.
        <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
          {team._count?.members ?? team.members?.length ?? 0} /{' '}
          {team.discipline?.maxPlayers || '-'} Jugadores
        </Badge>
      ),
    },
  ];

  // R22 — el menú de acciones sólo existe si hay al menos una acción permitida.
  if (onEdit || onDelete) {
    columnas.push({
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      // Celda con controles propios: se eleva sobre el overlay del link primario.
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (team) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Más acciones para ${team.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(team)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(team)}
                // `red-*` está fuera de la paleta institucional; `destructive-*` sí existe.
                className="text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });
  }

  return columnas;
}

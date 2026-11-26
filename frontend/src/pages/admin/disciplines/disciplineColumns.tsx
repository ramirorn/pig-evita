// ===========================================
// disciplineColumns — columnas de la tabla de disciplinas
// ===========================================
import { Pencil, Trash2, MoreVertical } from 'lucide-react';
import type { Discipline } from '@/types';
import { DisciplineType } from '@/types';
import { DISCIPLINE_TYPE_LABELS, RESULT_TYPE_LABELS } from '@/lib/constants';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { etiquetaEnum, rangoJugadores } from '@/lib/format';

interface DisciplineColumnActions {
  onEdit: (item: Discipline) => void;
  onDelete: (item: Discipline) => void;
}

/**
 * Cómo se ve cada fila. Vive fuera de la página (mismo layout que equipos y
 * sedes): la página sólo dice qué hacer al editar o eliminar.
 */
export function createDisciplineColumns({ onEdit, onDelete }: DisciplineColumnActions): DataTableColumn<Discipline>[] {
  const columnas: DataTableColumn<Discipline>[] = [
    {
      id: 'name',
      header: 'Nombre',
      mobile: 'primary',
      rowHeader: true,
      className: 'font-medium text-primary-900',
      headClassName: 'min-w-[180px]',
      cell: (discipline) => discipline.name,
    },
    {
      id: 'type',
      header: 'Tipo',
      mobile: 'secondary',
      cell: (discipline) => (
        // `variant="default"` y `variant="secondary"` no generan color:
        // `bg-primary` y `bg-secondary` no existen en el `@theme`. El tipo se
        // distingue con dos tonos de la paleta institucional que sí resuelven.
        <Badge
          variant="outline"
          className={
            discipline.type === DisciplineType.EQUIPO
              ? 'bg-primary-50 text-primary-700 border-primary-200'
              : 'bg-muted text-primary-700 border-primary-200'
          }
        >
          {etiquetaEnum(DISCIPLINE_TYPE_LABELS, discipline.type)}
        </Badge>
      ),
    },
    {
      id: 'result',
      header: 'Resultado',
      mobile: 'hidden',
      cell: (discipline) => etiquetaEnum(RESULT_TYPE_LABELS, discipline.resultType),
    },
    {
      id: 'players',
      header: 'Jugadores',
      mobile: 'secondary',
      className: 'tabular-nums',
      cell: (discipline) => rangoJugadores(discipline.minPlayers, discipline.maxPlayers),
    },
    {
      id: 'roster',
      header: 'Plantel',
      mobile: 'secondary',
      // Sólo las de equipo tienen plantel, y la que no lo tiene cargado no se
      // puede inscribir por plantel completo: se marca acá para que se vea en
      // el listado, sin tener que abrir cada una.
      cell: (discipline) => {
        if (discipline.type !== DisciplineType.EQUIPO) return '—';
        if (typeof discipline.titulares !== 'number') {
          return (
            <Badge
              variant="outline"
              className="bg-warning-50 text-warning-800 border-warning-200"
            >
              Sin configurar
            </Badge>
          );
        }
        return `${discipline.titulares} titulares + ${discipline.maxSuplentes ?? 0} supl.`;
      },
    },
    {
      id: 'status',
      header: 'Estado',
      mobile: 'secondary',
      cell: (discipline) =>
        discipline.isActive ? (
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activo
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Inactivo
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      mobile: 'actions',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (discipline) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${discipline.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(discipline)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(discipline)}
              className="text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return columnas;
}

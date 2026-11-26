// ===========================================
// categoryColumns — columnas de la tabla de categorías
// ===========================================
import { Pencil, Trash2, MoreVertical } from 'lucide-react';
import type { Category } from '@/types';
import { SEX_LABELS } from '@/lib/constants';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCategoryRange } from '@/lib/categoryRange';

interface CategoryColumnActions {
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}

/**
 * Cómo se ve cada fila. Vive fuera de la página (mismo layout que equipos y
 * sedes): la página sólo dice qué hacer al editar o eliminar.
 */
export function createCategoryColumns({ onEdit, onDelete }: CategoryColumnActions): DataTableColumn<Category>[] {
  const columnas: DataTableColumn<Category>[] = [
    {
      id: 'discipline',
      header: 'Disciplina',
      mobile: 'secondary',
      className: 'text-primary-600 font-medium',
      cell: (category) => category.discipline?.name || '—',
    },
    {
      id: 'name',
      header: 'Nombre / Categoría',
      mobile: 'primary',
      // Es el identificador de la fila, aunque no haya detalle al que navegar:
      // `<th scope="row">` hace que el lector lo repita como contexto de cada celda.
      rowHeader: true,
      className: 'font-bold text-primary-900',
      headClassName: 'min-w-[180px]',
      cell: (category) => category.name,
    },
    {
      id: 'ages',
      header: 'Rango',
      mobile: 'secondary',
      className: 'tabular-nums',
      cell: (category) => formatCategoryRange(category),
    },
    {
      id: 'sex',
      header: 'Sexo',
      mobile: 'secondary',
      cell: (category) => (
        // `variant="secondary"` no renderiza color: `bg-secondary` no existe en
        // el `@theme`. Se usan tokens explícitos que sí resuelven.
        <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
          {SEX_LABELS[category.sex]}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      mobile: 'secondary',
      cell: (category) =>
        category.isActive ? (
          // `green-*` y `red-*` están fuera de la paleta institucional.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activo
          </Badge>
        ) : (
          // Inactivo no es un error: el estado neutro lo comunica mejor que el rojo.
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
      cell: (category) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${category.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(category)}
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

// ===========================================
// userColumns — columnas de la tabla de usuarios
// ===========================================
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { ROLE_LABELS } from '@/lib/constants';
import type { User } from '@/types';

interface UserColumnActions {
  /** Sin handler (rol sin permiso) la columna de acciones no se dibuja. */
  onEdit?: (item: User) => void;
}

/**
 * Cómo se ve cada fila. Vive fuera de la página (mismo layout que equipos y
 * sedes): la página sólo dice qué hacer al editar o eliminar.
 */
export function createUserColumns({ onEdit }: UserColumnActions): DataTableColumn<User>[] {
  const columnas: DataTableColumn<User>[] = [
    {
      id: 'user',
      header: 'Usuario',
      mobile: 'primary',
      rowHeader: true,
      cell: (user) => (
        <div>
          <p className="font-semibold text-primary-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-primary-500">{user.email}</p>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Rol',
      mobile: 'secondary',
      cell: (user) => (
        <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200">
          {ROLE_LABELS[user.role] || user.role}
        </Badge>
      ),
    },
    {
      id: 'scope',
      header: 'Departamento / Zona',
      mobile: 'secondary',
      className: 'text-sm text-primary-700',
      cell: (user) =>
        user.department ? (
          <span>
            {user.department} {user.zone ? `(${user.zone})` : ''}
          </span>
        ) : (
          // `primary-400` daba 3.75:1 contra blanco (falla AA); `primary-500`
          // llega a 6.52:1 y la itálica conserva el matiz de "no informado".
          <span className="text-primary-500 italic">Provincial / General</span>
        ),
    },
    {
      id: 'status',
      header: 'Estado',
      mobile: 'secondary',
      cell: (user) =>
        user.isActive ? (
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activo
          </Badge>
        ) : (
          // `variant="secondary"` no renderiza color: `bg-secondary` no existe
          // en el `@theme`. Se usan tokens explícitos que sí resuelven.
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Inactivo
          </Badge>
        ),
    },
  ];

  if (onEdit) {
    columnas.push({
      id: 'actions',
      header: 'Acciones',
      mobile: 'actions',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[100px] text-right',
      className: 'text-right',
      cell: (user) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-600 hover:text-primary-900 hover:bg-primary-50"
          onClick={() => onEdit(user)}
          // `title` no es un nombre accesible confiable: el nombre va en `aria-label`.
          aria-label={`Editar a ${user.firstName} ${user.lastName}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      ),
    });
  }

  return columnas;
}

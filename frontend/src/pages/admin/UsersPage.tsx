// ===========================================
// Users Admin Page
// ===========================================
import { useState } from 'react';
import { UserCog, Search, Plus, Pencil } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermisos } from '@/hooks/usePermisos';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { UserForm } from './components/UserForm';
import { ROLE_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import type { User } from '@/types';

export function UsersPage() {
  // R22 — la pantalla la ven SUPER_ADMIN y ADMIN_PROVINCIAL, pero el alta, la
  // edición y la baja de usuarios son sólo del SUPER_ADMIN. Sin esto, el
  // ADMIN_PROVINCIAL veía "Nuevo Usuario", completaba el formulario y recibía
  // un 403 al guardar.
  const { puede } = usePermisos();
  const puedeGestionar = puede('USER_MANAGE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();

  // S06 — el buscador filtraba con `.includes()` sobre las 20 filas que trae el
  // backend por defecto (`pagination.dto.ts`, `limit = 20`): con 25 usuarios,
  // buscar el apellido del 23 decía "no hay coincidencias". Ahora busca el
  // backend, sobre el padrón entero, y la pantalla pagina.
  const debouncedSearch = useDebounce(search);

  const { data: usersData, isLoading, isFetching, isError, refetch } = useUsers({
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });

  // Tocar el filtro vuelve a la primera página: el resultado es otro y la
  // página en la que estabas puede ya no existir.
  const patchSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setPage(1);
  };

  const handleCreate = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(undefined);
  };

  // Las columnas se declaran fuera del JSX para que el bloque de la tabla no
  // vuelva a mezclar estructura, estados y contenido como antes de T27.
  const columns: DataTableColumn<User>[] = [
    {
      id: 'user',
      header: 'Usuario',
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
      cell: (user) => (
        <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200">
          {ROLE_LABELS[user.role] || user.role}
        </Badge>
      ),
    },
    {
      id: 'scope',
      header: 'Departamento / Zona',
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

  if (puedeGestionar) {
    columns.push({
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[100px] text-right',
      className: 'text-right',
      cell: (user) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-600 hover:text-primary-900 hover:bg-primary-50"
          onClick={() => handleEdit(user)}
          // `title` no es un nombre accesible confiable: el nombre va en `aria-label`.
          aria-label={`Editar a ${user.firstName} ${user.lastName}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios y administradores del sistema"
        icon={<UserCog className="w-5 h-5 text-white" />}
        actions={
          puedeGestionar ? (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Usuario
            </Button>
          ) : undefined
        }
      />

      <DataTable
        entityName="usuarios"
        columns={columns}
        rows={usersData?.data ?? []}
        getRowId={(user) => user.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRowInactive={(user) => !user.isActive}
        meta={usersData?.meta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={clearFilters}
        emptyIcon={<UserCog className="w-10 h-10" />}
        emptyTitle="Todavía no hay usuarios"
        emptyDescription="Registrá el primer usuario para empezar a operar el sistema."
        emptyAction={
          puedeGestionar ? (
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Crear Usuario
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar por nombre, apellido o email..."
              aria-label="Buscar usuarios"
              value={search}
              onChange={(e) => patchSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-900">
              {editingUser ? 'Modificar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            initialData={editingUser}
            onSuccess={closeModal}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

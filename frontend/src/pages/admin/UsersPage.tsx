// ===========================================
// Users Admin Page
// ===========================================
import { useMemo } from 'react';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import { createUserColumns } from './users/userColumns';
import { UserCog, Search, Plus } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermisos } from '@/hooks/usePermisos';
import { DataTable } from '@/components/shared/DataTable';
import { UserForm } from './components/UserForm';
import type { User } from '@/types';

interface SearchFilters {
  search: string;
}

const EMPTY_FILTERS: SearchFilters = { search: '' };

export function UsersPage() {
  // R22 — la pantalla la ven SUPER_ADMIN y ADMIN_PROVINCIAL, pero el alta, la
  // edición y la baja de usuarios son sólo del SUPER_ADMIN. Sin esto, el
  // ADMIN_PROVINCIAL veía "Nuevo Usuario", completaba el formulario y recibía
  // un 403 al guardar.
  const { puede } = usePermisos();
  const puedeGestionar = puede('USER_MANAGE');
  const crud = useCrudPageState<User, SearchFilters>(EMPTY_FILTERS);
  const { filters, page, limit, editing: editingUser } = crud;
  const { search } = filters;
  const { openEdit } = crud;

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
  const patchSearch = (value: string) => crud.patchFilters({ search: value });

  // Las columnas se declaran fuera del JSX para que el bloque de la tabla no
  // vuelva a mezclar estructura, estados y contenido como antes de T27.
  // Memoizadas: sin esto el DataTable recibía columnas nuevas en cada render
  // (cada tecla en el buscador) y re-renderizaba todas las celdas.
  const columns = useMemo(() => createUserColumns({ onEdit: puedeGestionar ? openEdit : undefined }), [puedeGestionar, openEdit]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios y administradores del sistema"
        icon={<UserCog className="w-5 h-5 text-white" />}
        actions={
          puedeGestionar ? (
            <Button onClick={crud.openCreate} className="gap-2">
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
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={crud.clearFilters}
        emptyIcon={<UserCog className="w-10 h-10" />}
        emptyTitle="Todavía no hay usuarios"
        emptyDescription="Registrá el primer usuario para empezar a operar el sistema."
        emptyAction={
          puedeGestionar ? (
            <Button onClick={crud.openCreate} className="gap-2">
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

      <Dialog open={crud.isFormOpen} onOpenChange={crud.onFormOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary-900">
              {editingUser ? 'Modificar Usuario' : 'Nuevo Usuario'}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            initialData={editingUser}
            onSuccess={crud.closeForm}
            onCancel={crud.closeForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

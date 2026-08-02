// ===========================================
// Users Admin Page
// ===========================================
import { useState } from 'react';
import { UserCog, Search, Plus, Pencil } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserForm } from './components/UserForm';
import { ROLE_LABELS } from '@/lib/constants';
import type { User } from '@/types';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();

  const { data: usersData, isLoading } = useUsers();

  const filtered = (usersData?.data || []).filter((user) =>
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.firstName.toLowerCase().includes(search.toLowerCase()) ||
    user.lastName.toLowerCase().includes(search.toLowerCase()) ||
    (user.department && user.department.toLowerCase().includes(search.toLowerCase())),
  );

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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios y administradores del sistema"
        icon={<UserCog className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar por nombre, email o depto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<UserCog className="w-10 h-10" />}
              title="Sin usuarios"
              description="No se encontraron usuarios registrados con los criterios ingresados."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Usuario
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Departamento / Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-primary-900">
                      <div>
                        <p className="font-semibold">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-primary-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200">
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-primary-700">
                      {user.department ? (
                        <span>{user.department} {user.zone ? `(${user.zone})` : ''}</span>
                      ) : (
                        <span className="text-primary-400">Provincial / General</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary-600 hover:text-primary-900 hover:bg-primary-50"
                        onClick={() => handleEdit(user)}
                        title="Editar usuario"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

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

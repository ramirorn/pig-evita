// ===========================================
// Users Admin Page
// ===========================================
import { useState } from 'react';
import { UserCog, Search, Plus, Loader2 } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const { data: usersData, isLoading } = useUsers();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <UserCog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Usuarios</h1>
            <p className="text-sm text-primary-500">Gestión de usuarios y administradores del sistema</p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar por nombre o email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-primary-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Cargando usuarios...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {usersData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-primary-500">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                ) : (
                  usersData?.data.map((user) => (
                    <tr key={user.id} className="hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-primary-900">{user.firstName} {user.lastName}</div>
                        <div className="text-primary-500 text-xs mt-0.5">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="uppercase text-xs font-bold tracking-wider">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={
                          user.isActive ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'
                        }>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

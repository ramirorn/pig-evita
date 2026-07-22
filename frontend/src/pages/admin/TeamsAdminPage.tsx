// ===========================================
// Teams Admin Page
// ===========================================
import { useState } from 'react';
import { UsersRound, Plus, Pencil, MoreVertical, Loader2 } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import type { Team } from '@/types';
import { TeamForm } from './components/TeamForm';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router';

export function TeamsAdminPage() {
  const [department, setDepartment] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>();

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({ 
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined 
  });
  
  const { data: teamsData, isLoading } = useTeams({
    department: department || undefined,
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
  });

  const handleCreate = () => {
    setEditingTeam(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeam(undefined);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <UsersRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Equipos</h1>
            <p className="text-sm text-primary-500">Gestión de equipos inscriptos</p>
          </div>
        </div>

        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Equipo
        </Button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex flex-wrap gap-4">
          <Input 
            placeholder="Buscar por departamento..." 
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full sm:w-[250px]"
          />
          
          <Select value={disciplineId} onValueChange={(v) => { setDisciplineId(v); setCategoryId('all'); }}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las disciplinas</SelectItem>
              {disciplines?.data.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={setCategoryId} disabled={disciplineId === 'all'}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.data.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-primary-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Cargando equipos...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamsData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-primary-500">
                      No se encontraron equipos
                    </TableCell>
                  </TableRow>
                ) : (
                  teamsData?.data.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <Link to={`/admin/equipos/${team.id}`} className="font-medium text-primary-600 hover:underline">
                          {team.name}
                        </Link>
                      </TableCell>
                      <TableCell>{team.discipline?.name || '—'}</TableCell>
                      <TableCell>{team.category?.name || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{team.department}</span>
                          <span className="text-xs text-primary-500">{team.locality}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {team.members?.length || 0} / {team.discipline?.maxPlayers || '-'} Jugadores
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(team)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}
            </DialogTitle>
          </DialogHeader>
          <TeamForm 
            initialData={editingTeam} 
            onSuccess={closeModal} 
            onCancel={closeModal} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

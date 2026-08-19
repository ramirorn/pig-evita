// ===========================================
// Teams Admin Page
// ===========================================
import { useState } from 'react';
import { UsersRound, Plus, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { useTeams, useDeleteTeam } from '@/hooks/useTeams';
import type { Team } from '@/types';
import { TeamForm } from './components/TeamForm';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

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
  const [locality, setLocality] = useState('');
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | undefined>();
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({ 
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined 
  });
  
  const { data: teamsData, isLoading } = useTeams({
    department: department || undefined,
    locality: locality || undefined,
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
    categoryId: categoryId !== 'all' ? categoryId : undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteTeam();

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

  const handleDeleteConfirm = async () => {
    if (!deletingTeam) return;
    try {
      await deleteMutation.mutateAsync(deletingTeam.id);
      setDeletingTeam(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Equipos"
        description="Gestión de equipos inscriptos y listas de buena fe"
        icon={<UsersRound className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Equipo
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex flex-wrap gap-4">
          <Select value={disciplineId} onValueChange={(v) => { setDisciplineId(v); setCategoryId('all'); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las disciplinas</SelectItem>
              {disciplines?.data.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }} disabled={disciplineId === 'all'}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.data.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input 
            placeholder="Buscar por departamento..." 
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            className="w-full sm:w-[200px]"
          />

          <Input 
            placeholder="Buscar por localidad..." 
            value={locality}
            onChange={(e) => { setLocality(e.target.value); setPage(1); }}
            className="w-full sm:w-[200px]"
          />
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={limit > 5 ? 8 : 5} columns={6} />
          ) : !teamsData?.data.length ? (
            <EmptyState
              icon={<UsersRound className="w-10 h-10" />}
              title="Sin equipos"
              description="No se encontraron equipos con los filtros seleccionados."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Equipo
                </Button>
              }
            />
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
                {teamsData.data.map((team) => (
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
                        {team._count?.members ?? team.members?.length ?? 0} / {team.discipline?.maxPlayers || '-'} Jugadores
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
                          <DropdownMenuItem
                            onClick={() => setDeletingTeam(team)}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {teamsData && teamsData.meta.totalPages > 1 && (
          <Pagination
            page={teamsData.meta.page}
            totalPages={teamsData.meta.totalPages}
            total={teamsData.meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        )}
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

      <ConfirmDeleteDialog
        isOpen={!!deletingTeam}
        title="¿Eliminar equipo?"
        description={`¿Estás seguro de que deseas eliminar el equipo "${deletingTeam?.name}"? Si ya posee partidos o inscripciones jugadas, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTeam(null)}
      />
    </div>
  );
}

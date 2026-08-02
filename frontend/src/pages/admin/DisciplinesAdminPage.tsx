// ===========================================
// Disciplines Admin Page
// ===========================================
import { useState } from 'react';
import { Trophy, Plus, Pencil, MoreVertical, Search } from 'lucide-react';
import { useDisciplines } from '@/hooks/useDisciplines';
import type { Discipline } from '@/types';
import { DisciplineType } from '@/types';
import { DisciplineForm } from './components/DisciplineForm';
import { DISCIPLINE_TYPE_LABELS, RESULT_TYPE_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';

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

export function DisciplinesAdminPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | undefined>();

  const { data, isLoading } = useDisciplines();

  const filteredDisciplines = (data?.data || []).filter((d) =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.type.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    setEditingDiscipline(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (discipline: Discipline) => {
    setEditingDiscipline(discipline);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDiscipline(undefined);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Disciplinas"
        description="Gestión de deportes y disciplinas de los Juegos Evita"
        icon={<Trophy className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Disciplina
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar por nombre..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : filteredDisciplines.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-10 h-10" />}
              title="Sin disciplinas"
              description="No se encontraron disciplinas registradas."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Disciplina
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Jugadores</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisciplines.map((discipline) => (
                  <TableRow key={discipline.id}>
                    <TableCell className="font-medium text-primary-900">
                      {discipline.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={discipline.type === DisciplineType.EQUIPO ? "default" : "secondary"}>
                        {DISCIPLINE_TYPE_LABELS[discipline.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{RESULT_TYPE_LABELS[discipline.resultType]}</TableCell>
                    <TableCell>
                      {discipline.minPlayers} - {discipline.maxPlayers}
                    </TableCell>
                    <TableCell>
                      {discipline.isActive ? (
                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(discipline)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
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
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingDiscipline ? 'Editar Disciplina' : 'Nueva Disciplina'}
            </DialogTitle>
          </DialogHeader>
          <DisciplineForm 
            initialData={editingDiscipline} 
            onSuccess={closeModal} 
            onCancel={closeModal} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

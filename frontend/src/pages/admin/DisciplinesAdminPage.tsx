// ===========================================
// Disciplines Admin Page
// ===========================================
import { useState } from 'react';
import { Trophy, Plus, Pencil, MoreVertical, Loader2 } from 'lucide-react';
import { useDisciplines } from '@/hooks/useDisciplines';
import type { Discipline } from '@/types';
import { DisciplineType } from '@/types';
import { DISCIPLINE_TYPE_LABELS, RESULT_TYPE_LABELS } from '@/lib/constants';
import { DisciplineForm } from './components/DisciplineForm';

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

  // Fetch disciplines with basic filters
  const { data, isLoading } = useDisciplines({
    name: search || undefined,
  });

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
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Disciplinas</h1>
            <p className="text-sm text-primary-500">Gestión de deportes y disciplinas</p>
          </div>
        </div>

        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Disciplina
        </Button>
      </div>

      {/* Filters and Table Card */}
      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <Input 
            placeholder="Buscar por nombre..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-primary-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Cargando disciplinas...</p>
            </div>
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
                {data?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-primary-500">
                      No se encontraron disciplinas
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data.map((discipline) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
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

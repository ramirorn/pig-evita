// ===========================================
// Categories Admin Page
// ===========================================
import { useState } from 'react';
import { Tag, Plus, Pencil, MoreVertical, Loader2 } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import type { Category } from '@/types';
import { SEX_LABELS } from '@/lib/constants';
import { CategoryForm } from './components/CategoryForm';
import { useDisciplines } from '@/hooks/useDisciplines';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CategoriesAdminPage() {
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();

  const { data: disciplines } = useDisciplines();
  const { data: categoriesData, isLoading } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
  });

  const handleCreate = () => {
    setEditingCategory(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(undefined);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Categorías</h1>
            <p className="text-sm text-primary-500">Gestión de rangos de edad y sexo por disciplina</p>
          </div>
        </div>

        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </Button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="w-full max-w-sm">
            <Select value={disciplineId} onValueChange={setDisciplineId}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {disciplines?.data.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-primary-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Cargando categorías...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Nombre / Categoría</TableHead>
                  <TableHead>Edades</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriesData?.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-primary-500">
                      No se encontraron categorías
                    </TableCell>
                  </TableRow>
                ) : (
                  categoriesData?.data.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="text-primary-600 font-medium">
                        {category.discipline?.name || '—'}
                      </TableCell>
                      <TableCell className="font-bold text-primary-900">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        {category.minAge} a {category.maxAge} años
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SEX_LABELS[category.sex]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {category.isActive ? (
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
                            <DropdownMenuItem onClick={() => handleEdit(category)}>
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
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm 
            initialData={editingCategory} 
            onSuccess={closeModal} 
            onCancel={closeModal} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

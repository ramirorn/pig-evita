// ===========================================
// Categories Admin Page
// ===========================================
import { useState } from 'react';
import { Tag, Plus, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import type { Category } from '@/types';
import { SEX_LABELS } from '@/lib/constants';
import { CategoryForm } from './components/CategoryForm';
import { useDisciplines } from '@/hooks/useDisciplines';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

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
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const { data: disciplines } = useDisciplines();
  const { data: categoriesData, isLoading } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
  });
  const deleteMutation = useDeleteCategory();

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

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      await deleteMutation.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Categorías"
        description="Gestión de rangos de edad y sexo por disciplina"
        icon={<Tag className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </Button>
        }
      />

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
            <SkeletonTable rows={5} columns={6} />
          ) : !categoriesData?.data.length ? (
            <EmptyState
              icon={<Tag className="w-10 h-10" />}
              title="Sin categorías"
              description="No se encontraron categorías registradas con el filtro seleccionado."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Categoría
                </Button>
              }
            />
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
                {categoriesData.data.map((category) => (
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
                          <DropdownMenuItem
                            onClick={() => setDeletingCategory(category)}
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

      <ConfirmDeleteDialog
        isOpen={!!deletingCategory}
        title="¿Eliminar categoría?"
        description={`¿Estás seguro de que deseas eliminar la categoría "${deletingCategory?.name}"? Si contiene inscripciones o equipos asociados, pasará a estado Inactivo.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCategory(null)}
      />
    </div>
  );
}

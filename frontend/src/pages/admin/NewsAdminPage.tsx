// ===========================================
// News Admin Page
// ===========================================
import { useState } from 'react';
import { Newspaper, Search, Plus, Pencil, Trash2, MoreVertical, Calendar } from 'lucide-react';
import { useNewsList, useDeleteNews } from '@/hooks/useNews';
import type { News } from '@/types';
import { NewsForm } from './components/NewsForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

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

export function NewsAdminPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | undefined>();
  const [deletingNews, setDeletingNews] = useState<News | null>(null);

  const { data: newsData, isLoading } = useNewsList();
  const deleteMutation = useDeleteNews();

  const filtered = (newsData?.data || []).filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.excerpt && item.excerpt.toLowerCase().includes(search.toLowerCase())),
  );

  const handleCreate = () => {
    setEditingNews(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (news: News) => {
    setEditingNews(news);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNews(undefined);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingNews) return;
    try {
      await deleteMutation.mutateAsync(deletingNews.id);
      setDeletingNews(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Noticias"
        description="Gestión de novedades y artículos públicos"
        icon={<Newspaper className="w-5 h-5 text-white" />}
        actions={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Noticia
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar noticias por título..." 
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
              icon={<Newspaper className="w-10 h-10" />}
              title="Sin noticias"
              description="No se encontraron artículos o novedades cargadas."
              action={
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Noticia
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Noticia</TableHead>
                  <TableHead>Fecha de Publicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-primary-900">
                      <div className="max-w-md">
                        <p className="font-semibold text-primary-900 line-clamp-1">{item.title}</p>
                        {item.excerpt && <p className="text-xs text-primary-500 line-clamp-2 mt-0.5">{item.excerpt}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-primary-600">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-primary-400" />
                        <span>
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('es-AR') : 'No publicada'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.isPublished ? (
                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                          Publicado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                          Borrador
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
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingNews(item)}
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

      {/* Modal Crear / Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>
              {editingNews ? 'Editar Noticia' : 'Nueva Noticia'}
            </DialogTitle>
          </DialogHeader>
          <NewsForm 
            initialData={editingNews} 
            onSuccess={closeModal} 
            onCancel={closeModal} 
          />
        </DialogContent>
      </Dialog>

      {/* Modal Confirmación de Eliminación */}
      <ConfirmDeleteDialog
        isOpen={!!deletingNews}
        title="¿Eliminar noticia?"
        description={`¿Estás seguro de que deseas eliminar la noticia "${deletingNews?.title}"? Esta acción no se puede deshacer.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingNews(null)}
      />
    </div>
  );
}

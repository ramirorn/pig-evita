// ===========================================
// News Admin Page
// ===========================================
import { useMemo, useState } from 'react';
import { Newspaper, Search, Plus, Pencil, Trash2, MoreVertical, Calendar } from 'lucide-react';
import { useNewsList, useDeleteNews } from '@/hooks/useNews';
import type { News } from '@/types';
import { NewsForm } from './components/NewsForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { logError } from '@/lib/logger';

export function NewsAdminPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | undefined>();
  const [deletingNews, setDeletingNews] = useState<News | null>(null);

  const { data: newsData, isLoading, isFetching, isError, refetch } = useNewsList();
  const deleteMutation = useDeleteNews();

  // El listado viene completo del backend: el filtrado por título/copete es
  // local y se memoiza para no recorrerlo en renders ajenos a la búsqueda.
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return newsData?.data ?? [];
    return (newsData?.data ?? []).filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.excerpt ?? '').toLowerCase().includes(needle),
    );
  }, [newsData, search]);

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
      logError('NewsAdminPage.handleDeleteConfirm', error);
    }
  };

  const columns: DataTableColumn<News>[] = [
    {
      id: 'news',
      header: 'Noticia',
      rowHeader: true,
      headClassName: 'min-w-[280px]',
      cell: (item) => (
        <div className="max-w-md">
          <p className="font-semibold text-primary-900 line-clamp-1">{item.title}</p>
          {item.excerpt && (
            <p className="text-xs text-primary-500 line-clamp-2 mt-0.5">{item.excerpt}</p>
          )}
        </div>
      ),
    },
    {
      id: 'published-at',
      header: 'Fecha de Publicación',
      className: 'text-primary-600',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs">
          {/* `primary-400` sirve como ícono decorativo (3.75:1 ≥ 3), nunca como texto. */}
          <Calendar className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
          <span>
            {item.publishedAt
              ? new Date(item.publishedAt).toLocaleDateString('es-AR')
              : 'No publicada'}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) =>
        item.isPublished ? (
          // `green-*` y `amber-*` están fuera de la paleta institucional;
          // además `amber-600/amber-50` no llegaba a AA.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Publicado
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-accent-50 text-accent-800 border-accent-300">
            Borrador
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[80px]',
      cell: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Más acciones para ${item.title}`}>
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
              className="text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

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

      <DataTable
        entityName="noticias"
        columns={columns}
        rows={filtered}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={() => setSearch('')}
        emptyIcon={<Newspaper className="w-10 h-10" />}
        emptyTitle="Todavía no hay noticias"
        emptyDescription="Publicá la primera novedad para que aparezca en el sitio público."
        emptyAction={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Crear Noticia
          </Button>
        }
        toolbar={
          <div className="relative flex-1 md:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Buscar noticias por título..."
              aria-label="Buscar noticias"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      {/* Modal Crear / Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle>{editingNews ? 'Editar Noticia' : 'Nueva Noticia'}</DialogTitle>
          </DialogHeader>
          <NewsForm initialData={editingNews} onSuccess={closeModal} onCancel={closeModal} />
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

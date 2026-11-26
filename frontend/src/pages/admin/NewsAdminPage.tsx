// ===========================================
// News Admin Page
// ===========================================
import { useMemo } from 'react';
import { useCrudPageState } from '@/hooks/useCrudPageState';
import { createNewsColumns } from './news/newsColumns';
import { Newspaper, Search, Plus, RefreshCw } from 'lucide-react';
import { useNewsList, useDeleteNews, useSyncNews } from '@/hooks/useNews';
import { usePermisos } from '@/hooks/usePermisos';
import { useDebounce } from '@/hooks/useDebounce';
import type { News } from '@/types';
import { NewsFormDialog } from './news/NewsFormDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logError } from '@/lib/logger';

interface SearchFilters {
  search: string;
}

const EMPTY_FILTERS: SearchFilters = { search: '' };

export function NewsAdminPage() {
  const crud = useCrudPageState<News, SearchFilters>(EMPTY_FILTERS);
  const { filters, page, limit, editing: editingNews, deleting: deletingNews } = crud;
  const { search } = filters;
  const { openEdit, askDelete } = crud;

  // S06 — el listado NO venía completo: venían las primeras 20 (el default de
  // `pagination.dto.ts`) y el filtrado en memoria sólo alcanzaba a esas. Es el
  // mismo bug que R29 corrigió en las noticias públicas, acá con 20 en vez de
  // 50. Ahora busca el backend, sobre `title` y `excerpt`, y la pantalla pagina.
  const debouncedSearch = useDebounce(search);

  const { data: newsData, isLoading, isFetching, isError, refetch } = useNewsList({
    search: debouncedSearch.trim() || undefined,
    page,
    limit,
  });
  const deleteMutation = useDeleteNews();

  // R22 — la pantalla no ofrece caminos que el backend va a cerrar. `NEWS_SYNC`
  // es más acotada que `NEWS_MANAGE` (sólo la línea provincial), así que el
  // botón de sincronizar no se pinta para todos los que ven esta pantalla.
  const { puede } = usePermisos();
  const syncMutation = useSyncNews();

  // Tocar el filtro vuelve a la primera página: el resultado es otro y la
  // página en la que estabas puede ya no existir.
  const patchSearch = (value: string) => crud.patchFilters({ search: value });

  const handleDeleteConfirm = async () => {
    if (!deletingNews) return;
    try {
      await deleteMutation.mutateAsync(deletingNews.id);
      crud.cancelDelete();
    } catch (error) {
      logError('NewsAdminPage.handleDeleteConfirm', error);
    }
  };

  // Memoizadas: sin esto el DataTable recibía columnas nuevas en cada render
  // (cada tecla en el buscador) y re-renderizaba todas las celdas.
  const columns = useMemo(() => createNewsColumns({ onEdit: openEdit, onDelete: askDelete }), [openEdit, askDelete]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Noticias"
        description="Gestión de novedades y artículos públicos"
        icon={<Newspaper className="w-5 h-5 text-white" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {puede('NEWS_SYNC') && (
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="gap-2"
                title="Trae las noticias de Juegos Evita publicadas en formosa.gob.ar"
              >
                <RefreshCw
                  className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {syncMutation.isPending ? 'Sincronizando…' : 'Sincronizar portal'}
              </Button>
            )}
            <Button onClick={crud.openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva Noticia
            </Button>
          </div>
        }
      />

      <DataTable
        entityName="noticias"
        columns={columns}
        rows={newsData?.data ?? []}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={newsData?.meta}
        onPageChange={crud.setPage}
        onLimitChange={crud.changeLimit}
        hasActiveFilters={search.trim().length > 0}
        onClearFilters={crud.clearFilters}
        emptyIcon={<Newspaper className="w-10 h-10" />}
        emptyTitle="Todavía no hay noticias"
        emptyDescription="Publicá la primera novedad para que aparezca en el sitio público."
        emptyAction={
          <Button onClick={crud.openCreate} className="gap-2">
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
              onChange={(e) => patchSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      {/* Modal Crear / Editar */}
      <NewsFormDialog
        open={crud.isFormOpen}
        onOpenChange={crud.onFormOpenChange}
        news={editingNews}
      />

      {/* Modal Confirmación de Eliminación */}
      <ConfirmDeleteDialog
        isOpen={!!deletingNews}
        title="¿Eliminar noticia?"
        description={`¿Estás seguro de que deseas eliminar la noticia "${deletingNews?.title}"? Esta acción no se puede deshacer.`}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => crud.cancelDelete()}
      />
    </div>
  );
}

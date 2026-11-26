// ===========================================
// useCrudPageState — estado común de las páginas de administración
// ===========================================
import { useCallback, useState } from 'react';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

/**
 * Estado que repetían todas las páginas CRUD (M5): filtros que vuelven a la
 * página 1, paginación, el modal de alta/edición y el registro a eliminar.
 *
 * - `F`: los filtros del listado (un objeto; si la página sólo tiene buscador,
 *   `{ search: '' }`).
 * - `T`: lo que se edita y se elimina (la fila, o su `id` si el form carga el
 *   detalle por su cuenta).
 *
 * Los handlers son estables (`useCallback`), así que se pueden pasar a
 * `useMemo` de las columnas sin invalidarlo en cada render.
 */
export function useCrudPageState<T, F extends object>(emptyFilters: F) {
  const [filters, setFilters] = useState<F>(emptyFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | undefined>();
  const [deleting, setDeleting] = useState<T | null>(null);

  // Tocar cualquier filtro vuelve a la primera página: el resultado es otro y
  // la página en la que estabas puede ya no existir.
  const patchFilters = useCallback((patch: Partial<F>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters);
    setPage(1);
    // `emptyFilters` es una constante de módulo en todas las páginas: estable.
  }, [emptyFilters]);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  const openCreate = useCallback(() => {
    setEditing(undefined);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((item: T) => {
    setEditing(item);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setEditing(undefined);
  }, []);

  /** Para el `onOpenChange` del `Dialog`: cerrarlo desde afuera limpia la edición. */
  const onFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open);
    if (!open) setEditing(undefined);
  }, []);

  const askDelete = useCallback((item: T) => setDeleting(item), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);

  return {
    filters,
    patchFilters,
    clearFilters,
    page,
    setPage,
    limit,
    changeLimit,
    isFormOpen,
    editing,
    openCreate,
    openEdit,
    closeForm,
    onFormOpenChange,
    deleting,
    askDelete,
    cancelDelete,
  };
}

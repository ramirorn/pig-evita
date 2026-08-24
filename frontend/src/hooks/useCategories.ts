// ===========================================
// React Query Hooks — Categories
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, type CategoryFilters, type CreateCategoryPayload, type UpdateCategoryPayload } from '@/api/categories.api';
import { STALE_TIME } from '@/lib/queryClient';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { getFriendlyError } from '@/lib/utils';
import { toast } from 'sonner';

export const CATEGORY_KEYS = {
  all: ['categories'] as const,
  lists: () => [...CATEGORY_KEYS.all, 'list'] as const,
  list: (filters: CategoryFilters) => [...CATEGORY_KEYS.lists(), filters] as const,
  listAll: (filters: CategoryFilters) => [...CATEGORY_KEYS.lists(), 'all', filters] as const,
  details: () => [...CATEGORY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CATEGORY_KEYS.details(), id] as const,
};

export function useCategories(filters: CategoryFilters = {}) {
  return useQuery({
    queryKey: CATEGORY_KEYS.list(filters),
    queryFn: () => categoriesApi.findAll(filters),
    staleTime: STALE_TIME.CATALOG,
  });
}

/**
 * Todas las categorías que matchean el filtro, recorriendo la paginación.
 *
 * Se usa para poblar selectores que necesitan el conjunto completo —típicamente
 * acotado por `disciplineId`—, donde un corte silencioso a la página 1 deja el
 * `<select>` vacío sin error ni toast.
 *
 * `enabled` en `false` mientras no haya con qué filtrar: pedir el catálogo
 * entero de categorías para descartarlo en el cliente es justamente lo que
 * rompía el asistente de inscripción.
 */
export function useAllCategories(
  filters: CategoryFilters = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: CATEGORY_KEYS.listAll(filters),
    queryFn: () =>
      fetchAllPages((page, limit) => categoriesApi.findAll({ ...filters, page, limit })),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: CATEGORY_KEYS.detail(id),
    queryFn: () => categoriesApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => categoriesApi.create(payload),
    onSuccess: () => {
      toast.success('Categoría creada exitosamente');
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear la categoría'));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) => 
      categoriesApi.update(id, payload),
    onSuccess: (data) => {
      toast.success('Categoría actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.detail(data.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar la categoría'));
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      toast.success('Categoría eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al eliminar la categoría'));
    },
  });
}

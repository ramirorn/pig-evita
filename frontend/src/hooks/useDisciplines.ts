// ===========================================
// React Query Hooks — Disciplines
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disciplinesApi, type DisciplineFilters, type CreateDisciplinePayload, type UpdateDisciplinePayload } from '@/api/disciplines.api';
import { STALE_TIME } from '@/lib/queryClient';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { getFriendlyError } from '@/lib/utils';
import { toast } from 'sonner';

export const DISCIPLINE_KEYS = {
  all: ['disciplines'] as const,
  lists: () => [...DISCIPLINE_KEYS.all, 'list'] as const,
  list: (filters: DisciplineFilters) => [...DISCIPLINE_KEYS.lists(), filters] as const,
  listAll: (filters: DisciplineFilters) => [...DISCIPLINE_KEYS.lists(), 'all', filters] as const,
  details: () => [...DISCIPLINE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...DISCIPLINE_KEYS.details(), id] as const,
};

export function useDisciplines(filters: DisciplineFilters = {}) {
  return useQuery({
    queryKey: DISCIPLINE_KEYS.list(filters),
    queryFn: () => disciplinesApi.findAll(filters),
    staleTime: STALE_TIME.CATALOG,
  });
}

/**
 * Todas las disciplinas, recorriendo la paginación hasta el final.
 *
 * La alternativa que había —`useDisciplines({ limit: 100 })`— parecía traer todo
 * pero 100 es el máximo que el backend acepta: con 101 disciplinas la última
 * desaparecía del selector sin que nada lo indicara. Devuelve el arreglo directo
 * porque no queda paginación de la que hablar.
 */
export function useAllDisciplines(filters: DisciplineFilters = {}) {
  return useQuery({
    queryKey: DISCIPLINE_KEYS.listAll(filters),
    queryFn: () =>
      fetchAllPages((page, limit) => disciplinesApi.findAll({ ...filters, page, limit })),
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useDiscipline(id: string) {
  return useQuery({
    queryKey: DISCIPLINE_KEYS.detail(id),
    queryFn: () => disciplinesApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useCreateDiscipline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDisciplinePayload) => disciplinesApi.create(payload),
    onSuccess: () => {
      toast.success('Disciplina creada exitosamente');
      queryClient.invalidateQueries({ queryKey: DISCIPLINE_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear la disciplina'));
    },
  });
}

export function useUpdateDiscipline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDisciplinePayload }) => 
      disciplinesApi.update(id, payload),
    onSuccess: (data) => {
      toast.success('Disciplina actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: DISCIPLINE_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: DISCIPLINE_KEYS.detail(data.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar la disciplina'));
    },
  });
}

export function useDeleteDiscipline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disciplinesApi.delete(id),
    onSuccess: () => {
      toast.success('Disciplina eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: DISCIPLINE_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al eliminar la disciplina'));
    },
  });
}

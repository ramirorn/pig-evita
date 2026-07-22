// ===========================================
// React Query Hooks — Disciplines
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disciplinesApi, type DisciplineFilters, type CreateDisciplinePayload, type UpdateDisciplinePayload } from '@/api/disciplines.api';
import { toast } from 'sonner';

export const DISCIPLINE_KEYS = {
  all: ['disciplines'] as const,
  lists: () => [...DISCIPLINE_KEYS.all, 'list'] as const,
  list: (filters: DisciplineFilters) => [...DISCIPLINE_KEYS.lists(), filters] as const,
  details: () => [...DISCIPLINE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...DISCIPLINE_KEYS.details(), id] as const,
};

export function useDisciplines(filters: DisciplineFilters = {}) {
  return useQuery({
    queryKey: DISCIPLINE_KEYS.list(filters),
    queryFn: () => disciplinesApi.findAll(filters),
  });
}

export function useDiscipline(id: string) {
  return useQuery({
    queryKey: DISCIPLINE_KEYS.detail(id),
    queryFn: () => disciplinesApi.findOne(id),
    enabled: !!id,
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
    onError: () => {
      toast.error('Error al crear la disciplina');
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
    onError: () => {
      toast.error('Error al actualizar la disciplina');
    },
  });
}

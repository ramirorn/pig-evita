// ===========================================
// React Query Hooks — Users
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  usersApi, 
  type UserFilters, 
  type CreateUserPayload,
  type UpdateUserPayload
} from '@/api/users.api';
import { STALE_TIME } from '@/lib/queryClient';
import { toast } from 'sonner';

export const USER_KEYS = {
  all: ['users'] as const,
  lists: () => [...USER_KEYS.all, 'list'] as const,
  list: (filters?: UserFilters) => [...USER_KEYS.lists(), { filters }] as const,
  details: () => [...USER_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: USER_KEYS.list(filters),
    queryFn: () => usersApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: () => usersApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      toast.success('Usuario creado exitosamente');
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al crear el usuario');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => 
      usersApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Usuario actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: USER_KEYS.detail(variables.id) });
    },
    onError: () => {
      toast.error('Error al actualizar el usuario');
    },
  });
}

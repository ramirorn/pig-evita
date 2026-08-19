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
import { useQueryScope } from './useQueryScope';
import { toast } from 'sonner';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['users', <userId>, 'list' | 'detail', ...]`. El dominio va
 * primero para que `invalidateQueries({ queryKey: ['users'] })` siga
 * alcanzando a todo el dominio; el `userId` va inmediatamente después, de modo
 * que dos usuarios nunca comparten una entrada.
 */
export const USER_KEYS = {
  all: (userId: string) => ['users', userId] as const,
  lists: (userId: string) => [...USER_KEYS.all(userId), 'list'] as const,
  list: (userId: string, filters?: UserFilters) =>
    [...USER_KEYS.lists(userId), { filters }] as const,
  details: (userId: string) => [...USER_KEYS.all(userId), 'detail'] as const,
  detail: (userId: string, id: string) =>
    [...USER_KEYS.details(userId), id] as const,
};

export function useUsers(filters?: UserFilters) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: USER_KEYS.list(scope, filters),
    queryFn: () => usersApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useUser(id: string) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: USER_KEYS.detail(scope, id),
    queryFn: () => usersApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      toast.success('Usuario creado exitosamente');
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists(scope) });
    },
    onError: () => {
      toast.error('Error al crear el usuario');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => 
      usersApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Usuario actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: USER_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: USER_KEYS.detail(scope, variables.id) });
    },
    onError: () => {
      toast.error('Error al actualizar el usuario');
    },
  });
}

// ===========================================
// React Query Hooks — Participants
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  participantsApi, 
  type ParticipantFilters, 
  type CreateParticipantPayload, 
  type UpdateParticipantPayload 
} from '@/api/participants.api';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
import { useQueryScope } from './useQueryScope';
import { toast } from 'sonner';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['participants', <userId>, 'list' | 'detail', ...]`. El dominio va
 * primero para que `invalidateQueries({ queryKey: ['participants'] })` siga
 * alcanzando a todo el dominio; el `userId` va inmediatamente después, de modo
 * que dos usuarios nunca comparten una entrada.
 */
export const PARTICIPANT_KEYS = {
  all: (userId: string) => ['participants', userId] as const,
  lists: (userId: string) => [...PARTICIPANT_KEYS.all(userId), 'list'] as const,
  list: (userId: string, filters?: ParticipantFilters) =>
    [...PARTICIPANT_KEYS.lists(userId), { filters }] as const,
  details: (userId: string) => [...PARTICIPANT_KEYS.all(userId), 'detail'] as const,
  detail: (userId: string, id: string) =>
    [...PARTICIPANT_KEYS.details(userId), id] as const,
};

export function useParticipants(filters?: ParticipantFilters) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: PARTICIPANT_KEYS.list(scope, filters),
    queryFn: () => participantsApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useParticipant(id: string) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: PARTICIPANT_KEYS.detail(scope, id),
    queryFn: () => participantsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useParticipantByDni(dni: string) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: [...PARTICIPANT_KEYS.details(scope), 'dni', dni],
    queryFn: () => participantsApi.findByDni(dni),
    enabled: !!dni && dni.length >= 7,
    retry: false, // Don't retry if not found, since it's a valid case when searching
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateParticipant() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (payload: CreateParticipantPayload) => participantsApi.create(payload),
    onSuccess: () => {
      toast.success('Participante creado exitosamente');
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.lists(scope) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear el participante'));
    },
  });
}

export function useUpdateParticipant() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateParticipantPayload }) => 
      participantsApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Participante actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.detail(scope, variables.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar el participante'));
    },
  });
}

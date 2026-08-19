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
import { toast } from 'sonner';

export const PARTICIPANT_KEYS = {
  all: ['participants'] as const,
  lists: () => [...PARTICIPANT_KEYS.all, 'list'] as const,
  list: (filters?: ParticipantFilters) => [...PARTICIPANT_KEYS.lists(), { filters }] as const,
  details: () => [...PARTICIPANT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PARTICIPANT_KEYS.details(), id] as const,
};

export function useParticipants(filters?: ParticipantFilters) {
  return useQuery({
    queryKey: PARTICIPANT_KEYS.list(filters),
    queryFn: () => participantsApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useParticipant(id: string) {
  return useQuery({
    queryKey: PARTICIPANT_KEYS.detail(id),
    queryFn: () => participantsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useParticipantByDni(dni: string) {
  return useQuery({
    queryKey: [...PARTICIPANT_KEYS.details(), 'dni', dni],
    queryFn: () => participantsApi.findByDni(dni),
    enabled: !!dni && dni.length >= 7,
    retry: false, // Don't retry if not found, since it's a valid case when searching
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateParticipantPayload) => participantsApi.create(payload),
    onSuccess: () => {
      toast.success('Participante creado exitosamente');
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al crear el participante');
    },
  });
}

export function useUpdateParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateParticipantPayload }) => 
      participantsApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Participante actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: PARTICIPANT_KEYS.detail(variables.id) });
    },
    onError: () => {
      toast.error('Error al actualizar el participante');
    },
  });
}

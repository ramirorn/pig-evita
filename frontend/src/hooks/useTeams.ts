// ===========================================
// React Query Hooks — Teams
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, type TeamFilters, type CreateTeamPayload, type UpdateTeamPayload, type AddTeamMemberPayload } from '@/api/teams.api';
import { STALE_TIME } from '@/lib/queryClient';
import { useQueryScope } from './useQueryScope';
import { toast } from 'sonner';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['teams', <userId>, 'list' | 'detail', ...]`. El dominio va
 * primero para que `invalidateQueries({ queryKey: ['teams'] })` siga
 * alcanzando a todo el dominio; el `userId` va inmediatamente después, de modo
 * que dos usuarios nunca comparten una entrada.
 */
export const TEAM_KEYS = {
  all: (userId: string) => ['teams', userId] as const,
  lists: (userId: string) => [...TEAM_KEYS.all(userId), 'list'] as const,
  list: (userId: string, filters: TeamFilters) =>
    [...TEAM_KEYS.lists(userId), filters] as const,
  details: (userId: string) => [...TEAM_KEYS.all(userId), 'detail'] as const,
  detail: (userId: string, id: string) =>
    [...TEAM_KEYS.details(userId), id] as const,
};

export function useTeams(filters: TeamFilters = {}) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: TEAM_KEYS.list(scope, filters),
    queryFn: () => teamsApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useTeam(id: string) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: TEAM_KEYS.detail(scope, id),
    queryFn: () => teamsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamsApi.create(payload),
    onSuccess: () => {
      toast.success('Equipo creado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists(scope) });
    },
    onError: () => {
      toast.error('Error al crear el equipo');
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTeamPayload }) => 
      teamsApi.update(id, payload),
    onSuccess: (data) => {
      toast.success('Equipo actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(scope, data.id) });
    },
    onError: () => {
      toast.error('Error al actualizar el equipo');
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ teamId, payload }: { teamId: string; payload: AddTeamMemberPayload }) => 
      teamsApi.addMember(teamId, payload),
    onSuccess: (_, variables) => {
      toast.success('Miembro añadido al equipo');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(scope, variables.teamId) });
    },
    onError: () => {
      toast.error('Error al añadir miembro');
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ teamId, participantId }: { teamId: string; participantId: string }) => 
      teamsApi.removeMember(teamId, participantId),
    onSuccess: (_, variables) => {
      toast.success('Miembro removido del equipo');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(scope, variables.teamId) });
    },
    onError: () => {
      toast.error('Error al remover miembro');
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      toast.success('Equipo eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists(scope) });
    },
    onError: () => {
      toast.error('Error al eliminar el equipo');
    },
  });
}

// ===========================================
// React Query Hooks — Teams
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, type TeamFilters, type CreateTeamPayload, type UpdateTeamPayload, type AddTeamMemberPayload } from '@/api/teams.api';
import { toast } from 'sonner';

export const TEAM_KEYS = {
  all: ['teams'] as const,
  lists: () => [...TEAM_KEYS.all, 'list'] as const,
  list: (filters: TeamFilters) => [...TEAM_KEYS.lists(), filters] as const,
  details: () => [...TEAM_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TEAM_KEYS.details(), id] as const,
};

export function useTeams(filters: TeamFilters = {}) {
  return useQuery({
    queryKey: TEAM_KEYS.list(filters),
    queryFn: () => teamsApi.findAll(filters),
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: TEAM_KEYS.detail(id),
    queryFn: () => teamsApi.findOne(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => teamsApi.create(payload),
    onSuccess: () => {
      toast.success('Equipo creado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al crear el equipo');
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTeamPayload }) => 
      teamsApi.update(id, payload),
    onSuccess: (data) => {
      toast.success('Equipo actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(data.id) });
    },
    onError: () => {
      toast.error('Error al actualizar el equipo');
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, payload }: { teamId: string; payload: AddTeamMemberPayload }) => 
      teamsApi.addMember(teamId, payload),
    onSuccess: (_, variables) => {
      toast.success('Miembro añadido al equipo');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(variables.teamId) });
    },
    onError: () => {
      toast.error('Error al añadir miembro');
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, participantId }: { teamId: string; participantId: string }) => 
      teamsApi.removeMember(teamId, participantId),
    onSuccess: (_, variables) => {
      toast.success('Miembro removido del equipo');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.detail(variables.teamId) });
    },
    onError: () => {
      toast.error('Error al remover miembro');
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      toast.success('Equipo eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al eliminar el equipo');
    },
  });
}

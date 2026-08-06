// ===========================================
// Teams API
// ===========================================
import apiClient from './client';
import type { Team, TeamMember, PaginatedResponse } from '@/types';

export interface TeamFilters {
  page?: number;
  limit?: number;
  disciplineId?: string;
  categoryId?: string;
  department?: string;
  locality?: string;
  search?: string;
}

export interface CreateTeamPayload {
  name: string;
  disciplineId: string;
  categoryId: string;
  locality: string;
  department: string;
}

export type UpdateTeamPayload = Partial<CreateTeamPayload>;

export interface AddTeamMemberPayload {
  participantId: string;
  position?: string;
  shirtNumber?: number;
  isCaptain?: boolean;
}

export const teamsApi = {
  async findAll(filters?: TeamFilters): Promise<PaginatedResponse<Team>> {
    const { data } = await apiClient.get<PaginatedResponse<Team>>('/teams', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Team> {
    const { data } = await apiClient.get<Team>(`/teams/${id}`);
    return data;
  },

  async create(payload: CreateTeamPayload): Promise<Team> {
    const { data } = await apiClient.post<Team>('/teams', payload);
    return data;
  },

  async update(id: string, payload: UpdateTeamPayload): Promise<Team> {
    const { data } = await apiClient.patch<Team>(`/teams/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async addMember(teamId: string, payload: AddTeamMemberPayload): Promise<TeamMember> {
    const { data } = await apiClient.post<TeamMember>(`/teams/${teamId}/members`, payload);
    return data;
  },

  async removeMember(teamId: string, participantId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/members/${participantId}`);
  },
};

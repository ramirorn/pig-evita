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
  /**
   * Sólo se usa en el formulario para filtrar las categorías de esa disciplina.
   *
   * **No viaja al backend:** `CreateTeamDto` no lo declara y el `ValidationPipe`
   * corre con `forbidNonWhitelisted`, así que mandarlo devolvía
   * `400 property disciplineId should not exist` y el alta de equipos estaba
   * rota. El backend deduce la disciplina de la categoría
   * (`teams.service.create` → `category.discipline`), de modo que el dato es
   * redundante además de rechazado.
   */
  disciplineId: string;
  categoryId: string;
  locality: string;
  department: string;
}

export type UpdateTeamPayload = Partial<CreateTeamPayload>;

/** Saca `disciplineId` antes de mandar el payload (ver el comentario de arriba). */
function sinDisciplineId<T extends { disciplineId?: string }>(
  payload: T,
): Omit<T, 'disciplineId'> {
  const { disciplineId: _disciplineId, ...resto } = payload;
  return resto;
}

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
    const { data } = await apiClient.post<Team>('/teams', sinDisciplineId(payload));
    return data;
  },

  async update(id: string, payload: UpdateTeamPayload): Promise<Team> {
    const { data } = await apiClient.patch<Team>(
      `/teams/${id}`,
      sinDisciplineId(payload),
    );
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

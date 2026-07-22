// ===========================================
// Competitions API
// ===========================================
import apiClient from './client';
import type { Competition, PaginatedResponse } from '@/types';

export interface CompetitionFilters {
  page?: number;
  limit?: number;
  disciplineId?: string;
  categoryId?: string;
  stage?: string;
  status?: string;
}

export interface CreateCompetitionPayload {
  disciplineId: string;
  categoryId: string;
  stage: string;
  format: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  config?: Record<string, unknown>;
}

export type UpdateCompetitionPayload = Partial<CreateCompetitionPayload>;

export interface GenerateFixturePayload {
  participantIds?: string[];
  teamIds?: string[];
}

export const competitionsApi = {
  async findAll(filters?: CompetitionFilters): Promise<PaginatedResponse<Competition>> {
    const { data } = await apiClient.get<PaginatedResponse<Competition>>('/competitions', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Competition> {
    const { data } = await apiClient.get<Competition>(`/competitions/${id}`);
    return data;
  },

  async create(payload: CreateCompetitionPayload): Promise<Competition> {
    const { data } = await apiClient.post<Competition>('/competitions', payload);
    return data;
  },

  async update(id: string, payload: UpdateCompetitionPayload): Promise<Competition> {
    const { data } = await apiClient.patch<Competition>(`/competitions/${id}`, payload);
    return data;
  },

  async generateFixture(id: string, payload: GenerateFixturePayload): Promise<Competition> {
    const { data } = await apiClient.post<Competition>(`/competitions/${id}/fixture`, payload);
    return data;
  },
};

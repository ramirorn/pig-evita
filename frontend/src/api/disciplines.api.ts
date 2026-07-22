// ===========================================
// Disciplines API
// ===========================================
import apiClient from './client';
import type { Discipline, PaginatedResponse } from '@/types';

export interface DisciplineFilters {
  page?: number;
  limit?: number;
  name?: string;
  type?: string;
  isActive?: boolean;
}

export interface CreateDisciplinePayload {
  name: string;
  type: string;
  resultType: string;
  rules?: string;
  minPlayers?: number;
  maxPlayers?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateDisciplinePayload = Partial<CreateDisciplinePayload>;

export const disciplinesApi = {
  async findAll(filters?: DisciplineFilters): Promise<PaginatedResponse<Discipline>> {
    const { data } = await apiClient.get<PaginatedResponse<Discipline>>('/disciplines', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Discipline> {
    const { data } = await apiClient.get<Discipline>(`/disciplines/${id}`);
    return data;
  },

  async create(payload: CreateDisciplinePayload): Promise<Discipline> {
    const { data } = await apiClient.post<Discipline>('/disciplines', payload);
    return data;
  },

  async update(id: string, payload: UpdateDisciplinePayload): Promise<Discipline> {
    const { data } = await apiClient.patch<Discipline>(`/disciplines/${id}`, payload);
    return data;
  },
};

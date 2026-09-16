// ===========================================
// Disciplines API
// ===========================================
import apiClient from './client';
import type { Discipline, PaginatedResponse } from '@/types';

export interface DisciplineFilters {
  page?: number;
  limit?: number;
  type?: string;
  isActive?: boolean;
  /**
   * Búsqueda server-side sobre el nombre (`DisciplineFilterDto` → `search`, con
   * `mode: 'insensitive'` en Prisma). Reemplaza al viejo `name`, que el backend
   * nunca leyó: viajaba en la query y se descartaba en el `ValidationPipe`.
   */
  search?: string;
}

export interface CreateDisciplinePayload {
  name: string;
  type: string;
  resultType: string;
  rules?: string;
  minPlayers?: number;
  maxPlayers?: number;
  /**
   * Plantel reglamentario de las disciplinas de equipo. Viaja `null` —y no
   * ausente— cuando la disciplina deja de ser de equipo: en un PATCH, ausente
   * significa "no lo toques" y el plantel viejo quedaría pegado.
   */
  titulares?: number | null;
  maxSuplentes?: number | null;
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

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/disciplines/${id}`);
  },
};

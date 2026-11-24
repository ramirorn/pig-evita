// ===========================================
// Categories API
// ===========================================
import apiClient from './client';
import type { AgeCriterion, Category, PaginatedResponse } from '@/types';

export interface CategoryFilters {
  page?: number;
  limit?: number;
  disciplineId?: string;
  sex?: string;
  isActive?: boolean;
  /**
   * Búsqueda server-side sobre el nombre (`CategoryFilterDto` → `search`, con
   * `mode: 'insensitive'` en Prisma).
   */
  search?: string;
}

export interface CreateCategoryPayload {
  disciplineId: string;
  name: string;
  ageCriterion: AgeCriterion;
  /** El par del otro criterio viaja en `null`: el backend lo descarta igual. */
  minAge: number | null;
  maxAge: number | null;
  minBirthYear: number | null;
  maxBirthYear: number | null;
  sex: string;
  isActive?: boolean;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export const categoriesApi = {
  async findAll(filters?: CategoryFilters): Promise<PaginatedResponse<Category>> {
    const { data } = await apiClient.get<PaginatedResponse<Category>>('/categories', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Category> {
    const { data } = await apiClient.get<Category>(`/categories/${id}`);
    return data;
  },

  async create(payload: CreateCategoryPayload): Promise<Category> {
    const { data } = await apiClient.post<Category>('/categories', payload);
    return data;
  },

  async update(id: string, payload: UpdateCategoryPayload): Promise<Category> {
    const { data } = await apiClient.patch<Category>(`/categories/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
  },
};

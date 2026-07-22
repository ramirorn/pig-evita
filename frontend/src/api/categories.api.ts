// ===========================================
// Categories API
// ===========================================
import apiClient from './client';
import type { Category, PaginatedResponse } from '@/types';

export interface CategoryFilters {
  page?: number;
  limit?: number;
  disciplineId?: string;
  sex?: string;
  isActive?: boolean;
}

export interface CreateCategoryPayload {
  disciplineId: string;
  name: string;
  minAge: number;
  maxAge: number;
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
};

// ===========================================
// News API
// ===========================================
import apiClient from './client';
import type { News, PaginatedResponse } from '@/types';

export interface NewsFilters {
  page?: number;
  limit?: number;
  isPublished?: boolean;
}

export interface CreateNewsPayload {
  title: string;
  content: string;
  excerpt?: string;
  imageKey?: string;
  isPublished?: boolean;
}

export type UpdateNewsPayload = Partial<CreateNewsPayload>;

export const newsApi = {
  async findAll(filters?: NewsFilters): Promise<PaginatedResponse<News>> {
    const { data } = await apiClient.get<PaginatedResponse<News>>('/news', { params: filters });
    return data;
  },

  async findBySlug(slug: string): Promise<News> {
    const { data } = await apiClient.get<News>(`/news/slug/${slug}`);
    return data;
  },

  async findOne(id: string): Promise<News> {
    const { data } = await apiClient.get<News>(`/news/${id}`);
    return data;
  },

  async create(payload: CreateNewsPayload): Promise<News> {
    const { data } = await apiClient.post<News>('/news', payload);
    return data;
  },

  async update(id: string, payload: UpdateNewsPayload): Promise<News> {
    const { data } = await apiClient.patch<News>(`/news/${id}`, payload);
    return data;
  },
};

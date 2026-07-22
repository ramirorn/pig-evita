// ===========================================
// Venues API
// ===========================================
import apiClient from './client';
import type { Venue, PaginatedResponse } from '@/types';

export interface VenueFilters {
  page?: number;
  limit?: number;
  department?: string;
  isActive?: boolean;
}

export interface CreateVenuePayload {
  name: string;
  address: string;
  department: string;
  locality: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  isActive?: boolean;
}

export type UpdateVenuePayload = Partial<CreateVenuePayload>;

export const venuesApi = {
  async findAll(filters?: VenueFilters): Promise<PaginatedResponse<Venue>> {
    const { data } = await apiClient.get<PaginatedResponse<Venue>>('/venues', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Venue> {
    const { data } = await apiClient.get<Venue>(`/venues/${id}`);
    return data;
  },

  async create(payload: CreateVenuePayload): Promise<Venue> {
    const { data } = await apiClient.post<Venue>('/venues', payload);
    return data;
  },

  async update(id: string, payload: UpdateVenuePayload): Promise<Venue> {
    const { data } = await apiClient.patch<Venue>(`/venues/${id}`, payload);
    return data;
  },
};

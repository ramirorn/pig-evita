// ===========================================
// Participants API
// ===========================================
import apiClient from './client';
import type { Participant, PaginatedResponse } from '@/types';

export interface ParticipantFilters {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  locality?: string;
  sex?: string;
}

export interface CreateParticipantPayload {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  phone?: string;
  email?: string;
  locality: string;
  department: string;
  address?: string;
}

export type UpdateParticipantPayload = Partial<CreateParticipantPayload>;

export const participantsApi = {
  async findAll(filters?: ParticipantFilters): Promise<PaginatedResponse<Participant>> {
    const { data } = await apiClient.get<PaginatedResponse<Participant>>('/participants', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<Participant> {
    const { data } = await apiClient.get<Participant>(`/participants/${id}`);
    return data;
  },

  async findByDni(dni: string): Promise<Participant> {
    const { data } = await apiClient.get<Participant>(`/participants/dni/${dni}`);
    return data;
  },

  async create(payload: CreateParticipantPayload): Promise<Participant> {
    const { data } = await apiClient.post<Participant>('/participants', payload);
    return data;
  },

  async update(id: string, payload: UpdateParticipantPayload): Promise<Participant> {
    const { data } = await apiClient.patch<Participant>(`/participants/${id}`, payload);
    return data;
  },
};

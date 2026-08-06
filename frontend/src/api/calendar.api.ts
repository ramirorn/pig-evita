// ===========================================
// Calendar API
// ===========================================
import apiClient from './client';
import type { CalendarEvent, PaginatedResponse } from '@/types';

export interface CalendarFilters {
  page?: number;
  limit?: number;
  stage?: string;
  disciplineId?: string;
  fromDate?: string;
  toDate?: string;
  isPublished?: boolean;
}

export interface CreateCalendarEventPayload {
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  stage?: string | null;
  venueId?: string | null;
  disciplineId?: string | null;
  isPublished?: boolean;
}

export type UpdateCalendarEventPayload = Partial<CreateCalendarEventPayload>;

export const calendarApi = {
  async findAll(filters?: CalendarFilters): Promise<PaginatedResponse<CalendarEvent>> {
    const { data } = await apiClient.get<PaginatedResponse<CalendarEvent>>('/calendar', { params: filters });
    return data;
  },

  async findOne(id: string): Promise<CalendarEvent> {
    const { data } = await apiClient.get<CalendarEvent>(`/calendar/${id}`);
    return data;
  },

  async create(payload: CreateCalendarEventPayload): Promise<CalendarEvent> {
    const { data } = await apiClient.post<CalendarEvent>('/calendar', payload);
    return data;
  },

  async update(id: string, payload: UpdateCalendarEventPayload): Promise<CalendarEvent> {
    const { data } = await apiClient.patch<CalendarEvent>(`/calendar/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/calendar/${id}`);
  },
};

// ===========================================
// Venues API
// ===========================================
import apiClient from './client';
import type { Venue, PaginatedResponse } from '@/types';

export interface VenueFilters {
  page?: number;
  limit?: number;
  department?: string;
  locality?: string;
  isActive?: boolean;
  /**
   * Búsqueda server-side sobre el nombre de la sede (`VenueFilterDto` →
   * `search`). El filtrado local también miraba dirección y localidad, pero lo
   * hacía sólo sobre las 20 sedes de la primera página (S06).
   */
  search?: string;
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

export interface UploadVenueImageOptions {
  /** Avance de la subida en bytes; `total` puede faltar si el navegador no lo sabe. */
  onProgress?: (loaded: number, total: number | undefined) => void;
  /** Para cancelar la subida. */
  signal?: AbortSignal;
}

/** Una foto de 5 MB por 3G tarda más que los 15 s del cliente (igual que documentos). */
const UPLOAD_TIMEOUT_MS = 2 * 60_000;

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

  async delete(id: string): Promise<{ success: boolean; message?: string }> {
    const { data } = await apiClient.delete(`/venues/${id}`);
    return data;
  },

  /** Sube o reemplaza la foto principal (multipart, campo `file`). Devuelve la sede con `imageUrl`. */
  async uploadImage(id: string, file: File, options: UploadVenueImageOptions = {}): Promise<Venue> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<Venue>(`/venues/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: options.onProgress
        ? (event) => options.onProgress?.(event.loaded, event.total)
        : undefined,
    });
    return data;
  },

  /** Quita la foto (idempotente). Devuelve la sede con `imageUrl: null`. */
  async deleteImage(id: string): Promise<Venue> {
    const { data } = await apiClient.delete<Venue>(`/venues/${id}/image`);
    return data;
  },
};

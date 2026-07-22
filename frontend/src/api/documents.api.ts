// ===========================================
// Documents API
// ===========================================
import apiClient from './client';
import type { DocumentEntity } from '@/types';

export interface ReviewDocumentPayload {
  status: 'APROBADO' | 'RECHAZADO';
  rejectionNote?: string;
}

export const documentsApi = {
  /** Upload a document (multipart/form-data) */
  async upload(participantId: string, type: string, file: File): Promise<DocumentEntity> {
    const formData = new FormData();
    formData.append('participantId', participantId);
    formData.append('type', type);
    formData.append('file', file);

    const { data } = await apiClient.post<DocumentEntity>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /** List documents for a participant */
  async findByParticipant(participantId: string): Promise<DocumentEntity[]> {
    const { data } = await apiClient.get<DocumentEntity[]>(`/documents/participant/${participantId}`);
    return data;
  },

  /** Review (approve/reject) a document */
  async review(id: string, payload: ReviewDocumentPayload): Promise<DocumentEntity> {
    const { data } = await apiClient.patch<DocumentEntity>(`/documents/${id}/review`, payload);
    return data;
  },
};

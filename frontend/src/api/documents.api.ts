// ===========================================
// Documents API
// ===========================================
import apiClient from './client';
import type { DocumentEntity, DocumentStatus, DocumentType } from '@/types';

/**
 * Cuerpo de `PATCH /documents/:id/review` (`ReviewDocumentDto`).
 *
 * El campo se llama `notes`, no `rejectionNote`: el backend corre con
 * `forbidNonWhitelisted`, así que mandar el nombre de la columna respondía 400
 * a todo rechazo. La nota es obligatoria al rechazar.
 */
export interface ReviewDocumentPayload {
  status: DocumentStatus.APROBADO | DocumentStatus.RECHAZADO;
  notes?: string;
}

export interface UploadDocumentOptions {
  /** Avance de la subida en bytes; `total` puede faltar si el navegador no lo sabe. */
  onProgress?: (loaded: number, total: number | undefined) => void;
  /** Para cancelar la subida (el uploader aborta al desmontarse o al reemplazar). */
  signal?: AbortSignal;
}

/**
 * Una foto de 5 MB por 3G tarda bastante más que los 15 s del cliente. Si se
 * cortara por timeout, el delegado vería "se cortó la conexión" con señal
 * perfecta y reintentaría para siempre.
 */
const UPLOAD_TIMEOUT_MS = 2 * 60_000;

export const documentsApi = {
  /** Upload a document (multipart/form-data) */
  async upload(
    participantId: string,
    type: DocumentType,
    file: File,
    options: UploadDocumentOptions = {},
  ): Promise<DocumentEntity> {
    const formData = new FormData();
    formData.append('participantId', participantId);
    formData.append('type', type);
    formData.append('file', file);

    const { data } = await apiClient.post<DocumentEntity>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: options.onProgress
        ? (event) => options.onProgress?.(event.loaded, event.total)
        : undefined,
    });
    return data;
  },

  /** List documents for a participant (newest first, with presigned URLs) */
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

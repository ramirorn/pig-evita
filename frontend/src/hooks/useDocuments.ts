// ===========================================
// React Query Hooks — Documents
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  documentsApi,
  type ReviewDocumentPayload,
  type UploadDocumentOptions,
} from '@/api/documents.api';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
import { DOCUMENT_TYPE_LABELS } from '@/lib/documents/documentRules';
import { DocumentStatus, type DocumentType } from '@/types';
import { useQueryScope } from './useQueryScope';
import { toast } from 'sonner';

/**
 * Claves namespaceadas por usuario, igual que participantes e inscripciones:
 * el backend recorta por alcance y un delegado ve lista vacía donde un admin
 * ve la carpeta completa. Dos sesiones no pueden compartir entrada.
 */
export const DOCUMENT_KEYS = {
  all: (userId: string) => ['documents', userId] as const,
  participant: (userId: string, participantId: string) =>
    [...DOCUMENT_KEYS.all(userId), 'participant', participantId] as const,
};

export function useParticipantDocuments(participantId: string | null | undefined) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: DOCUMENT_KEYS.participant(scope, participantId ?? ''),
    queryFn: () => documentsApi.findByParticipant(participantId ?? ''),
    enabled: Boolean(participantId),
    // Las URLs pre-firmadas vencen: no conviene estirar más que lo operativo.
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export interface UploadDocumentVariables extends UploadDocumentOptions {
  participantId: string;
  type: DocumentType;
  file: File;
}

/**
 * Subida de un archivo.
 *
 * A diferencia del resto de las mutaciones, **no tira toasts**: el uploader
 * muestra el estado y el error en su propia tarjeta (con `aria-live`), que es
 * donde está mirando la persona. En un plantel de 16 integrantes, 48 toasts
 * apilados no le dirían a quién le falló la foto.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ participantId, type, file, onProgress, signal }: UploadDocumentVariables) =>
      documentsApi.upload(participantId, type, file, { onProgress, signal }),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: DOCUMENT_KEYS.participant(scope, variables.participantId),
      }),
  });
}

export function useReviewDocument() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewDocumentPayload }) =>
      documentsApi.review(id, payload),
    onSuccess: (data) => {
      const label = DOCUMENT_TYPE_LABELS[data.documentType];
      toast.success(
        data.status === DocumentStatus.APROBADO ? `${label}: aprobado` : `${label}: rechazado`,
      );
      return queryClient.invalidateQueries({
        queryKey: DOCUMENT_KEYS.participant(scope, data.participantId),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo guardar la revisión. Probá de nuevo.'));
    },
  });
}
